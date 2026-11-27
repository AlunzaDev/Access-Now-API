import express from "express";
import { createHash, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorService } from "../../src/api/middlewares/errors/error-handler";
import { bcryptPlugin } from "../../src/config/plugins/bcrypt.plugin";
import { PostgresDatabase } from "../../src/infrastructure/prisma/postgres.database";
import { AppRoutes } from "../../src/presentation/routes/routes";

// Tickets: issuing (one and in batch), secure QR, honest status changes, history and the
// gateway scan (POST /v1/tickets/validate).
type Json = Record<string, any>;

const db = () => PostgresDatabase.client;
const tag = `tkt-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Secreta123";
const TERMINAL_MAC = "AA:BB:CC:DD:70:01";
let server: Server;
let base = "";

const call = async (
  method: string,
  path: string,
  { body, token, fingerprint }: { body?: unknown; token?: string; fingerprint?: string } = {},
) => {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fingerprint ? { "X-Device-Fingerprint": fingerprint } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: (await response.json()) as Json };
};

describe("boletos", () => {
  const ids = { project: "", other: "", gateway: "", terminal: "" };
  let token = "";
  const gatewayToken = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const fingerprint = `fp-${tag}`;
  const tickets = (projectId = ids.project) => `/proyectos/${projectId}/boletos`;
  const scan = (body: Json) => call("POST", "/v1/tickets/validate", { token: gatewayToken, fingerprint, body });
  /** An event happening right now (all day, every day) so its tickets are valid. */
  const newEvent = async (overrides: Json = {}) =>
    (
      await call("POST", `/proyectos/${ids.project}/eventos`, {
        token,
        body: {
          nombre: "Evento abierto",
          fechaInicio: "2020-01-01",
          fechaFin: "2099-12-31",
          horaInicio: "00:00",
          horaFin: "23:59",
          ...overrides,
        },
      })
    ).body.id as string;
  const sell = async (eventoId: string, titularNombre = "Ada Lovelace") =>
    (await call("POST", tickets(), { token, body: { eventoId, titularNombre } })).body;

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
    ids.project = (await db().project.create({ data: { nombre: tag, clave: tag.toUpperCase() } })).id;
    ids.other = (await db().project.create({ data: { nombre: `${tag}-otro`, clave: `${tag}-O`.toUpperCase() } })).id;
    ids.gateway = (
      await db().device.create({
        data: {
          projectId: ids.project,
          tipo: "GATEWAY",
          nombre: "Puerta 1",
          ip: "10.7.0.1",
          deviceTokenHash: createHash("sha256").update(gatewayToken).digest("hex"),
          deviceFingerprint: fingerprint,
          enrolledAt: new Date(),
        },
      })
    ).id;
    ids.terminal = (
      await db().device.create({
        data: {
          projectId: ids.project,
          tipo: "TERMINAL",
          nombre: "Torniquete 1",
          ip: "10.7.0.10",
          mac: TERMINAL_MAC,
          gatewayId: ids.gateway,
          sentido: "ENTRADA",
        },
      })
    ).id;

    const app = express();
    app.use(express.json());
    app.use(AppRoutes.routes);
    app.use(ErrorService.middleware);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    token = (await call("POST", "/auth/login", { body: { correo: `super-${tag}@example.test`, password: PASSWORD } }))
      .body.token;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await db().project.deleteMany({ where: { id: { in: [ids.project, ids.other] } } });
    await db().user.deleteMany({ where: { apellido: tag } });
    await PostgresDatabase.disconnect();
  });

  it("issues a ticket with a secure, recoverable QR and keeps it out of listings", async () => {
    const eventId = await newEvent({ nombre: "Con QR" });
    const created = await call("POST", tickets(), {
      token,
      body: { eventoId: eventId, titularNombre: "Ada Lovelace", titularCorreo: "ADA@example.test" },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ estadoVenta: "VENDIDO", titularCorreo: "ada@example.test", estadoAcceso: "VIGENTE" });
    expect(created.body.token).toMatch(/^AN1\.[A-Za-z0-9_-]{43}$/);

    const stored = await db().ticketCredential.findFirstOrThrow({ where: { ticketId: created.body.id } });
    expect(JSON.stringify(stored)).not.toContain(created.body.token);

    const qr = await call("GET", `${tickets()}/${created.body.id}/qr`, { token });
    expect(qr.body).toMatchObject({ token: created.body.token, folio: created.body.folio });

    const list = await call("GET", `${tickets()}?eventoId=${eventId}`, { token });
    expect(list.body.total).toBe(1);
    expect(JSON.stringify(list.body)).not.toContain("AN1.");

    const detail = await call("GET", `${tickets()}/${created.body.id}`, { token });
    expect(detail.body.historial.map((item: Json) => item.tipo)).toEqual(["QR_CONSULTADO", "VENDIDO"]);
    expect((await call("GET", `${tickets(ids.other)}/${created.body.id}`, { token })).status).toBe(404);

    const reissued = await call("POST", `${tickets()}/${created.body.id}/reemitir-qr`, { token });
    expect(reissued.body.token).not.toBe(created.body.token);
    expect(await db().ticketCredential.count({ where: { ticketId: created.body.id, revocadoEn: null } })).toBe(1);
    expect((await scan({ token: created.body.token })).body).toMatchObject({ acceso: "RECHAZADO", boleto: null });
  });

  it("creates a batch of 1000 tickets at once, within capacity", async () => {
    const eventId = await newEvent({ nombre: "Masivo", capacidad: 1001 });
    const batch = await call("POST", `${tickets()}/lote`, { token, body: { eventoId: eventId, cantidad: 1000 } });
    expect(batch.status).toBe(201);
    expect(batch.body.total).toBe(1000);
    expect(new Set(batch.body.items.map((item: Json) => item.token)).size).toBe(1000);
    expect(batch.body.items[0]).toMatchObject({ estadoVenta: "DISPONIBLE", titularNombre: "" });
    expect(await db().ticketEvent.count({ where: { ticket: { eventId }, tipo: "GENERADO" } })).toBe(1000);

    const over = await call("POST", `${tickets()}/lote`, { token, body: { eventoId: eventId, cantidad: 2 } });
    expect(over.status).toBe(409);
    expect(over.body.message).toContain("1 boleto");
  }, 60_000);

  it("allows only honest sale changes and freezes used or cancelled tickets", async () => {
    const eventId = await newEvent({ nombre: "Ventas" });
    const available = (await call("POST", tickets(), { token, body: { eventoId: eventId } })).body;
    expect((await call("PATCH", `${tickets()}/${available.id}`, { token, body: { estadoVenta: "RESERVADO" } })).status)
      .toBe(200);
    expect((await call("PATCH", `${tickets()}/${available.id}`, { token, body: { estadoVenta: "DISPONIBLE" } })).status)
      .toBe(200);

    const sold = await sell(eventId);
    const unsell = await call("PATCH", `${tickets()}/${sold.id}`, { token, body: { estadoVenta: "DISPONIBLE" } });
    expect(unsell.status).toBe(409);
    expect(unsell.body.message).toContain("cancélalo");

    expect((await scan({ token: sold.token })).body.acceso).toBe("CONCEDIDO");
    expect((await call("PATCH", `${tickets()}/${sold.id}`, { token, body: { titularNombre: "Otra" } })).status).toBe(409);
    expect((await call("DELETE", `${tickets()}/${sold.id}`, { token })).status).toBe(409);

    const toCancel = await sell(eventId, "Grace Hopper");
    expect((await call("DELETE", `${tickets()}/${toCancel.id}`, { token })).body).toMatchObject({
      estadoVenta: "CANCELADO",
      estadoAcceso: "ANULADO",
    });
    expect((await call("DELETE", `${tickets()}/${toCancel.id}`, { token })).status).toBe(409);
    expect(await db().ticketEvent.count({ where: { ticketId: toCancel.id, tipo: "CANCELADO" } })).toBe(1);
  });

  it("lets nobody in to an inactive event and issues no tickets for it", async () => {
    const eventId = await newEvent({ nombre: "Se desactiva" });
    const sold = await sell(eventId);
    await call("PATCH", `/proyectos/${ids.project}/eventos/${eventId}`, { token, body: { estado: false } });

    expect((await call("POST", tickets(), { token, body: { eventoId: eventId } })).status).toBe(409);
    expect((await call("POST", `${tickets()}/lote`, { token, body: { eventoId: eventId, cantidad: 1 } })).status).toBe(409);
    expect((await scan({ token: sold.token })).body).toMatchObject({
      acceso: "RECHAZADO",
      message: "El evento está inactivo",
      boleto: { estadoAcceso: "EVENTO_INACTIVO" },
    });
  });

  it("validates a scan from the gateway once, recording the terminal by its MAC", async () => {
    const eventId = await newEvent({ nombre: "Acceso" });
    const sold = await sell(eventId);

    const granted = await scan({ token: sold.token, terminalMac: "aa-bb-cc-dd-70-01" });
    expect(granted.status).toBe(200);
    expect(granted.body).toMatchObject({ acceso: "CONCEDIDO", boleto: { folio: sold.folio, estadoAcceso: "USADO" } });
    // The terminal gets what it shows, never the holder's contact data.
    expect(granted.body.boleto).not.toHaveProperty("titularCorreo");
    expect(granted.body.boleto).not.toHaveProperty("titularTelefono");

    const again = await scan({ token: sold.token, terminalMac: TERMINAL_MAC });
    expect(again.body).toMatchObject({ acceso: "RECHAZADO", message: "El boleto ya fue utilizado" });

    const history = await db().ticketEvent.findMany({ where: { ticketId: sold.id }, orderBy: { createdAt: "asc" } });
    const access = history.filter((item) => item.tipo.startsWith("ACCESO"));
    expect(access.map((item) => item.terminalId)).toEqual([ids.terminal, ids.terminal]);
    expect(access[0].detalle).toMatchObject({ gatewayId: ids.gateway, terminalMac: TERMINAL_MAC });
  });

  it("answers unknown or malformed QR codes as a rejection the terminal can show", async () => {
    const unknown = await scan({ token: `AN1.${"A".repeat(43)}` });
    expect(unknown).toMatchObject({ status: 200, body: { acceso: "RECHAZADO", boleto: null } });
    const garbage = await scan({ token: "https://example.com/promo" });
    expect(garbage).toMatchObject({ status: 200, body: { acceso: "RECHAZADO", message: "QR no reconocido" } });

    expect((await scan({ token: "x", terminalMac: "torniquete-1" })).status).toBe(400);
    expect((await scan({ token: "x", terminalId: ids.terminal })).status).toBe(400);
    // A ticket of another project is unknown to this gateway.
    const otherEvent = (
      await call("POST", `/proyectos/${ids.other}/eventos`, {
        token,
        body: { nombre: "Ajeno", fechaInicio: "2020-01-01", fechaFin: "2099-12-31", horaInicio: "00:00", horaFin: "23:59" },
      })
    ).body.id;
    const foreign = (await call("POST", tickets(ids.other), { token, body: { eventoId: otherEvent, titularNombre: "X" } })).body;
    expect((await scan({ token: foreign.token })).body).toMatchObject({ acceso: "RECHAZADO", boleto: null });
  });
});
