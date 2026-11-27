import express from "express";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorService } from "../../src/api/middlewares/errors/error-handler";
import { TicketDocumentService } from "../../src/application/services/ticket/ticket-document.service";
import { envs } from "../../src/config";
import { bcryptPlugin } from "../../src/config/plugins/bcrypt.plugin";
import type { EmailMessage, EmailSender } from "../../src/domain/ports/email/email-sender.port";
import { PdfkitTicketDocumentRenderer } from "../../src/infrastructure/document/pdfkit-ticket-document.renderer";
import { PostgresDatabase } from "../../src/infrastructure/prisma/postgres.database";
import { buildTicketDeliveryRepository } from "../../src/presentation/dependencies/repositories/repositories.dependencies";
import { AppRoutes } from "../../src/presentation/routes/routes";

// Printable tickets (PDF) and their delivery by email.
type Json = Record<string, any>;

const db = () => PostgresDatabase.client;
const tag = `doc-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Secreta123";
let server: Server;
let base = "";

const call = async (method: string, path: string, { body, token }: { body?: unknown; token?: string } = {}) => {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const isPdf = response.headers.get("content-type")?.includes("application/pdf");
  return {
    status: response.status,
    headers: response.headers,
    pdf: isPdf ? Buffer.from(await response.arrayBuffer()) : null,
    body: isPdf ? ({} as Json) : ((await response.json()) as Json),
  };
};

/** Pages of a PDF made by pdfkit (each page object is written uncompressed). */
const pageCount = (pdf: Buffer) => pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;

describe("PDF y envío de boletos", () => {
  const ids = { project: "", other: "", event: "" };
  let token = "";
  const tickets = (projectId = ids.project) => `/proyectos/${projectId}/boletos`;
  const sell = async (body: Json = {}) =>
    (await call("POST", tickets(), { token, body: { eventoId: ids.event, titularNombre: "Ada Lovelace", ...body } })).body;

  beforeAll(async () => {
    await PostgresDatabase.connect({ databaseUrl: process.env.DATABASE_URL!, poolMax: 4 });
    await db().user.create({
      data: {
        nombre: "Super",
        apellido: tag,
        correo: `super-${tag}@example.test`,
        rol: "SUPER_ROLE",
        password: bcryptPlugin.hash(PASSWORD),
      },
    });
    ids.project = (
      await db().project.create({
        data: { nombre: tag, clave: tag.toUpperCase(), direccion: "Av. Siempre Viva 742", latitud: 19.43, longitud: -99.13 },
      })
    ).id;
    ids.other = (await db().project.create({ data: { nombre: `${tag}-otro`, clave: `${tag}-O`.toUpperCase() } })).id;

    const app = express();
    app.use(express.json());
    app.use(AppRoutes.routes);
    app.use(ErrorService.middleware);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    token = (await call("POST", "/auth/login", { body: { correo: `super-${tag}@example.test`, password: PASSWORD } }))
      .body.token;
    ids.event = (
      await call("POST", `/proyectos/${ids.project}/eventos`, {
        token,
        body: { nombre: "Festival de invierno", fechaInicio: "2026-12-12", fechaFin: "2026-12-12", horaInicio: "20:00", horaFin: "23:00" },
      })
    ).body.id;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await db().project.deleteMany({ where: { id: { in: [ids.project, ids.other] } } });
    await db().user.deleteMany({ where: { apellido: tag } });
    await PostgresDatabase.disconnect();
  });

  it("serves one ticket as a PDF and records that its QR was shown", async () => {
    const sold = await sell();
    const response = await call("GET", `${tickets()}/${sold.id}/pdf`, { token });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(`inline; filename="boleto-${sold.folio}.pdf"`);
    expect(response.pdf!.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(response.pdf!)).toBe(1);
    expect(await db().ticketEvent.count({ where: { ticketId: sold.id, tipo: "QR_CONSULTADO" } })).toBe(1);
  });

  it("puts several tickets in one PDF, one per page", async () => {
    const first = await sell();
    const second = (await call("POST", tickets(), { token, body: { eventoId: ids.event } })).body; // disponible
    const response = await call("POST", `${tickets()}/pdf`, { token, body: { ids: [first.id, second.id] } });
    expect(response.status).toBe(200);
    expect(pageCount(response.pdf!)).toBe(2);
    expect(response.headers.get("content-disposition")).toContain("boletos-2.pdf");

    expect((await call("POST", `${tickets()}/pdf`, { token, body: { ids: [] } })).status).toBe(400);
    expect((await call("POST", `${tickets()}/pdf`, { token, body: { ids: Array.from({ length: 201 }, randomUUID) } })).status)
      .toBe(400);
    expect((await call("POST", `${tickets()}/pdf`, { token, body: { ids: [first.id], otro: 1 } })).status).toBe(400);
  });

  it("refuses cancelled tickets and tickets of another project", async () => {
    const cancelled = await sell();
    await call("DELETE", `${tickets()}/${cancelled.id}`, { token });
    expect((await call("GET", `${tickets()}/${cancelled.id}/pdf`, { token })).status).toBe(409);
    expect((await call("POST", `${tickets()}/${cancelled.id}/enviar`, { token, body: { correo: "a@example.test" } })).status)
      .toBe(409);
    const sold = await sell();
    expect((await call("GET", `${tickets(ids.other)}/${sold.id}/pdf`, { token })).status).toBe(404);
  });

  it("asks for an address, refuses unsold tickets and records a failed send", async () => {
    const noEmail = await sell();
    const missing = await call("POST", `${tickets()}/${noEmail.id}/enviar`, { token, body: {} });
    expect(missing.status).toBe(400);
    expect(missing.body.message).toContain("indica a cuál enviarlo");

    const available = (await call("POST", tickets(), { token, body: { eventoId: ids.event } })).body;
    expect((await call("POST", `${tickets()}/${available.id}/enviar`, { token, body: { correo: "a@example.test" } })).status)
      .toBe(409);

    // The test environment has no SMTP: the attempt fails, and stays on record.
    const failed = await call("POST", `${tickets()}/${noEmail.id}/enviar`, { token, body: { correo: "ada@example.test" } });
    expect(failed.status).toBe(503);
    const ticket = await call("GET", `${tickets()}/${noEmail.id}`, { token });
    expect(ticket.body).toMatchObject({ estadoEnvio: "ERROR", enviadoA: "", titularCorreo: "" });
    expect(ticket.body.historial[0]).toMatchObject({ tipo: "ENVIO_FALLIDO", detalle: { correo: "ada@example.test" } });
    const history = await call("GET", `${tickets()}/${noEmail.id}/envios`, { token });
    expect(history.body.items).toEqual([
      expect.objectContaining({ correo: "ada@example.test", estado: "ERROR", actor: expect.objectContaining({ nombre: `Super ${tag}` }) }),
    ]);
  });

  it("emails the PDF to the holder, keeping a new address and the delivery status", async () => {
    const sent: EmailMessage[] = [];
    const mailer: EmailSender = { send: async (message) => { sent.push(message); return true; } };
    const service = new TicketDocumentService(
      buildTicketDeliveryRepository(), new PdfkitTicketDocumentRenderer(), mailer, envs.TICKET_QR_ENCRYPTION_KEY,
    );

    const holder = await sell({ titularCorreo: "ada@example.test" });
    expect(await service.send(ids.project, holder.id)).toEqual({ estadoEnvio: "ENVIADO", enviadoA: "ada@example.test" });
    expect(sent[0]).toMatchObject({ to: "ada@example.test", subject: "Tu boleto para Festival de invierno" });
    expect(sent[0].attachments?.[0]).toMatchObject({ filename: `boleto-${holder.folio}.pdf`, contentType: "application/pdf" });
    expect(sent[0].attachments![0].content.subarray(0, 5).toString()).toBe("%PDF-");
    expect(sent[0].htmlBody).toContain("Sábado 12 de diciembre de 2026 · 20:00 a 23:00");
    expect(sent[0].htmlBody).toContain(holder.folio);

    // A ticket without address keeps the one it was sent to.
    const noEmail = await sell();
    await service.send(ids.project, noEmail.id, "Nuevo@Example.test");
    const stored = await db().ticket.findUniqueOrThrow({ where: { id: noEmail.id } });
    expect(stored).toMatchObject({ estadoEnvio: "ENVIADO", enviadoA: "nuevo@example.test", titularCorreo: "nuevo@example.test" });

    // Another address for a ticket that has one: sent there, the holder's address stays.
    await service.send(ids.project, holder.id, "otra@example.test");
    const resent = await db().ticket.findUniqueOrThrow({ where: { id: holder.id } });
    expect(resent).toMatchObject({ titularCorreo: "ada@example.test", enviadoA: "otra@example.test" });
    expect(await db().ticketDelivery.count({ where: { ticketId: holder.id, estado: "ENVIADO" } })).toBe(2);
  });
});
