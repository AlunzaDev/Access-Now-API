import express from "express";
import { createHash, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorService } from "../../src/api/middlewares/errors/error-handler";
import { bcryptPlugin } from "../../src/config/plugins/bcrypt.plugin";
import { PostgresDatabase } from "../../src/infrastructure/prisma/postgres.database";
import { AppRoutes } from "../../src/presentation/routes/routes";

// Tickets without internet: the gateway's catalog (by QR hash, full then changes) and the
// upload of the scans it accepted offline.
type Json = Record<string, any>;

const db = () => PostgresDatabase.client;
const tag = `off-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Secreta123";
const TERMINAL_MAC = "AA:BB:CC:DD:80:01";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
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

describe("boletos sin conexión", () => {
  const ids = { project: "", gateway: "", terminal: "", event: "" };
  let token = "";
  const gatewayToken = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const fingerprint = `fp-${tag}`;
  const asGateway = { token: gatewayToken, fingerprint };
  const catalog = (cursor?: string) =>
    call("GET", `/v1/tickets/catalogo${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, asGateway);
  const upload = (escaneos: Json[]) => call("POST", "/v1/tickets/escaneos-offline", { ...asGateway, body: { escaneos } });
  const newEvent = async (body: Json) =>
    (await call("POST", `/proyectos/${ids.project}/eventos`, { token, body })).body.id as string;
  const sell = async (eventoId = ids.event) =>
    (await call("POST", `/proyectos/${ids.project}/boletos`, { token, body: { eventoId, titularNombre: "Ada" } })).body;

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
    ids.gateway = (
      await db().device.create({
        data: {
          projectId: ids.project,
          tipo: "GATEWAY",
          nombre: "Puerta norte",
          ip: "10.8.0.1",
          deviceTokenHash: sha256(gatewayToken),
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
          ip: "10.8.0.10",
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
    ids.event = await newEvent({
      nombre: "En curso",
      fechaInicio: "2020-01-01",
      fechaFin: "2099-12-31",
      horaInicio: "00:00",
      horaFin: "23:59",
    });
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await db().project.deleteMany({ where: { id: ids.project } });
    await db().user.deleteMany({ where: { apellido: tag } });
    await PostgresDatabase.disconnect();
  });

  it("serves only events that are on and sold tickets, by hash and never the QR", async () => {
    const sold = await sell();
    await call("POST", `/proyectos/${ids.project}/boletos`, { token, body: { eventoId: ids.event } }); // disponible
    await newEvent({ nombre: "En un mes", fechaInicio: "2099-12-01", fechaFin: "2099-12-02", horaInicio: "10:00", horaFin: "20:00" });
    const inactive = await newEvent({ nombre: "Apagado", fechaInicio: "2020-01-01", fechaFin: "2099-12-31", horaInicio: "00:00", horaFin: "23:59" });
    await call("PATCH", `/proyectos/${ids.project}/eventos/${inactive}`, { token, body: { estado: false } });

    const full = await catalog();
    expect(full.status).toBe(200);
    expect(full.body.modo).toBe("completo");
    expect(full.body.eventos.map((event: Json) => event.nombre)).toEqual(["En curso"]);
    expect(full.body.eventos[0].fin).toMatch(/^2100-01-01T05:59:59\.999Z$/);
    expect(full.body.boletos).toEqual([
      { id: sold.id, eventoId: ids.event, folio: sold.folio, titularNombre: "Ada", hash: sha256(sold.token), estado: "VALIDO" },
    ]);
    expect(JSON.stringify(full.body)).not.toContain("AN1.");
    expect(typeof full.body.cursor).toBe("string");
  });

  it("then sends only changes: sales, cancellations, reissued QR and use at another gate", async () => {
    const { cursor } = (await catalog()).body;
    const toCancel = await sell();
    const toReissue = await sell();
    const usedOnline = await sell();
    await call("DELETE", `/proyectos/${ids.project}/boletos/${toCancel.id}`, { token });
    const reissued = (await call("POST", `/proyectos/${ids.project}/boletos/${toReissue.id}/reemitir-qr`, { token })).body;
    await call("POST", "/v1/tickets/validate", { ...asGateway, body: { token: usedOnline.token } });

    const changes = await catalog(cursor);
    expect(changes.body.modo).toBe("cambios");
    const byId = new Map(changes.body.boletos.map((ticket: Json) => [ticket.id, ticket]));
    expect(byId.get(toCancel.id)).toMatchObject({ estado: "NO_VALIDO", hash: null });
    expect(byId.get(toReissue.id)).toMatchObject({ estado: "VALIDO", hash: sha256(reissued.token) });
    expect(byId.get(usedOnline.id)).toMatchObject({ estado: "USADO" });

    // A new event in the window: the gateway never got its tickets, so the answer is complete.
    await newEvent({ nombre: "Recién creado", fechaInicio: "2020-01-01", fechaFin: "2099-12-31", horaInicio: "00:00", horaFin: "23:59" });
    expect((await catalog(changes.body.cursor)).body.modo).toBe("completo");
    expect((await catalog("basura")).body.modo).toBe("completo");
  });

  it("records offline scans with the real time, once, in scan order", async () => {
    const ticket = await sell();
    const hash = sha256(ticket.token);
    const first = "2026-11-27T20:00:00.000Z";
    const second = "2026-11-27T20:05:00.000Z";

    // Sent out of order: the earlier scan is the one that got in.
    const answer = await upload([
      { hash, escaneadoEn: second, terminalMac: TERMINAL_MAC },
      { hash, escaneadoEn: first, terminalMac: "aa-bb-cc-dd-80-01" },
    ]);
    expect(answer.status).toBe(200);
    expect(answer.body.resultados).toEqual([
      { hash, resultado: "ACEPTADO" },
      { hash, resultado: "DUPLICADO" },
    ]);
    const stored = await db().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(stored.usadoEn?.toISOString()).toBe(first);

    // The Raspberry resends after a lost answer: nothing is recorded twice.
    expect((await upload([{ hash, escaneadoEn: first }, { hash, escaneadoEn: second }])).body.resultados.map(
      (item: Json) => item.resultado,
    )).toEqual(["ACEPTADO", "DUPLICADO"]);
    const history = await db().ticketEvent.findMany({ where: { ticketId: ticket.id, tipo: { in: ["ACCESO_CONCEDIDO", "ACCESO_RECHAZADO"] } } });
    expect(history.map((item) => item.tipo).sort()).toEqual(["ACCESO_CONCEDIDO", "ACCESO_RECHAZADO"]);
    expect(history.every((item) => item.terminalId === ids.terminal)).toBe(true);
    expect(history.find((item) => item.tipo === "ACCESO_CONCEDIDO")?.detalle).toMatchObject({
      offline: true,
      escaneadoEn: first,
      gatewayId: ids.gateway,
    });

    // Online afterwards: already used.
    expect((await call("POST", "/v1/tickets/validate", { ...asGateway, body: { token: ticket.token } })).body.message)
      .toBe("El boleto ya fue utilizado");
  });

  it("flags tickets that were no longer valid and unknown codes", async () => {
    const cancelled = await sell();
    await call("DELETE", `/proyectos/${ids.project}/boletos/${cancelled.id}`, { token });
    const reissued = await sell();
    await call("POST", `/proyectos/${ids.project}/boletos/${reissued.id}/reemitir-qr`, { token });

    const answer = await upload([
      { hash: sha256(cancelled.token), escaneadoEn: Date.now() - 60_000 },
      { hash: sha256(reissued.token), escaneadoEn: Date.now() - 50_000 },
      { hash: "f".repeat(64), escaneadoEn: Date.now() - 40_000 },
    ]);
    expect(answer.body.resultados.map((item: Json) => item.resultado)).toEqual(["NO_VALIDO", "NO_VALIDO", "DESCONOCIDO"]);
    expect(await db().ticketEvent.count({ where: { ticketId: cancelled.id, tipo: "ACCESO_RECHAZADO" } })).toBe(1);
  });

  it("clamps a clock ahead and validates the upload", async () => {
    const ticket = await sell();
    await upload([{ hash: sha256(ticket.token), escaneadoEn: Date.now() + 3_600_000 }]);
    const stored = await db().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(stored.usadoEn!.getTime()).toBeLessThanOrEqual(Date.now());

    expect((await upload([])).status).toBe(400);
    expect((await upload([{ hash: "corto", escaneadoEn: Date.now() }])).status).toBe(400);
    expect((await upload([{ hash: "a".repeat(64), escaneadoEn: "ayer" }])).status).toBe(400);
    expect((await upload([{ hash: "a".repeat(64), escaneadoEn: Date.now(), otro: 1 }])).status).toBe(400);
    expect((await call("GET", "/v1/tickets/catalogo")).status).toBe(401);
    expect((await call("GET", "/v1/tickets/catalogo", { token: gatewayToken, fingerprint: "otra" })).status).toBe(401);
  });
});
