import express from "express";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorService } from "../../src/api/middlewares/errors/error-handler";
import { bcryptPlugin } from "../../src/config/plugins/bcrypt.plugin";
import { PostgresDatabase } from "../../src/infrastructure/prisma/postgres.database";
import { buildGatewayService } from "../../src/presentation/dependencies";
import { AppRoutes } from "../../src/presentation/routes/routes";

// Gateway (SCAT) API with the operational token: /me, heartbeat, real presence and history.
type Json = Record<string, any>;

const db = () => PostgresDatabase.client;
const tag = `gw-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Secreta123";
let server: Server;
let baseUrl = "";

const call = async (method: string, path: string, { body, token }: { body?: unknown; token?: string } = {}) => {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: (await response.json()) as Json };
};

describe("gateway: token operativo, heartbeat, estado e historial", () => {
  const ids = { project: "", gateway: "", terminal: "" };
  const tokens = { user: "", gateway: "" };
  const devicePath = (id: string) => `/proyectos/${ids.project}/dispositivos/${id}`;

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
      await db().device.create({ data: { projectId: ids.project, tipo: "GATEWAY", nombre: "GW", ip: "10.0.0.2" } })
    ).id;
    ids.terminal = (
      await db().device.create({
        data: {
          projectId: ids.project,
          tipo: "TERMINAL",
          nombre: "Torniquete 1",
          ip: "10.0.0.10",
          mac: "AA:BB:CC:DD:EE:01",
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
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    tokens.user = (
      await call("POST", "/auth/login", { body: { correo: `super-${tag}@example.test`, password: PASSWORD } })
    ).body.token;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await db().project.deleteMany({ where: { id: ids.project } });
    await db().user.deleteMany({ where: { apellido: tag } });
    await PostgresDatabase.disconnect();
  });

  it("shows a never-enrolled gateway offline, without inventing presence", async () => {
    const status = await call("GET", `${devicePath(ids.gateway)}/estado`, { token: tokens.user });
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({ tipo: "GATEWAY", enLinea: false, ultimaConexion: null, enrolamiento: null });
  });

  it("enrolls and authenticates the gateway with its operational token", async () => {
    const enrollmentToken = (
      await call("POST", `${devicePath(ids.gateway)}/token-enrolamiento`, {
        token: tokens.user,
        body: { vigenciaHoras: 1, duracionEnrolamientoDias: 30 },
      })
    ).body.token;
    const enrolled = await call("POST", "/v1/device/enroll", {
      body: { token: enrollmentToken, device_fingerprint: `fp-${tag}`, device_name: "GW" },
    });
    expect(enrolled.status).toBe(200);
    tokens.gateway = enrolled.body.token;

    const me = await call("GET", "/v1/me", { token: tokens.gateway });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ device: { id: ids.gateway, fingerprint: `fp-${tag}` }, service: { type: "online" } });

    expect((await call("GET", "/v1/me")).status).toBe(401);
    expect((await call("GET", "/v1/me", { token: "a".repeat(64) })).status).toBe(401);
    // A dashboard session token is not a gateway token.
    expect((await call("GET", "/v1/me", { token: tokens.user })).status).toBe(401);
  });

  it("accepts heartbeats, validates them and reports the gateway online", async () => {
    expect((await call("POST", "/v1/device/heartbeat", { token: tokens.gateway, body: { ip: "999.1.1.1" } })).status)
      .toBe(400);
    expect((await call("POST", "/v1/device/heartbeat", { token: tokens.gateway, body: { otro: 1 } })).status).toBe(400);

    const beat = await call("POST", "/v1/device/heartbeat", {
      token: tokens.gateway,
      body: { version: "1.4.0", ip: "10.0.0.20" },
    });
    expect(beat.status).toBe(200);
    expect(beat.body).toMatchObject({ ok: true, comandos: [] });

    const status = await call("GET", `${devicePath(ids.gateway)}/estado`, { token: tokens.user });
    expect(status.body.enLinea).toBe(true);
    expect(status.body.enrolamiento).toMatchObject({ activo: true, vencido: false, vencePronto: false });

    const device = await call("GET", devicePath(ids.gateway), { token: tokens.user });
    expect(device.body).toMatchObject({ ip: "10.0.0.20", version: "1.4.0", enLinea: true, enrolado: true });

    const terminal = await call("GET", `${devicePath(ids.terminal)}/estado`, { token: tokens.user });
    expect(terminal.body).toMatchObject({ tipo: "TERMINAL", enLinea: true, gateway: { id: ids.gateway } });
  });

  it("marks the gateway offline when it stops reporting and back online on the next heartbeat", async () => {
    const marked = await buildGatewayService().markStaleOffline(Date.now() + 10 * 60 * 1000);
    expect(marked).toBeGreaterThanOrEqual(1);
    expect((await db().device.findUniqueOrThrow({ where: { id: ids.gateway } })).enLinea).toBe(false);

    await call("POST", "/v1/device/heartbeat", { token: tokens.gateway, body: {} });
    expect((await db().device.findUniqueOrThrow({ where: { id: ids.gateway } })).enLinea).toBe(true);
  });

  it("keeps an immutable history, newest first, with the actor", async () => {
    const history = await call("GET", `${devicePath(ids.gateway)}/historial`, { token: tokens.user });
    expect(history.status).toBe(200);
    const types = history.body.items.map((event: Json) => event.tipo);
    // Enrolling already leaves it online, so the first heartbeat does not add another CONECTADO.
    expect(types).toEqual(["CONECTADO", "DESCONECTADO", "ENROLADO", "TOKEN_GENERADO"]);
    expect(history.body.total).toBe(4);
    const tokenEvent = history.body.items.at(-1);
    expect(tokenEvent.actor.nombre).toContain("Super");
    expect(tokenEvent.detalle).toMatchObject({ vigenciaHoras: 1, duracionEnrolamientoDias: 30 });
  });

  it("rejects a deactivated gateway and an expired enrollment", async () => {
    await db().device.update({ where: { id: ids.gateway }, data: { enrollmentExpiresAt: new Date(Date.now() - 1000) } });
    const expired = await call("GET", "/v1/me", { token: tokens.gateway });
    expect(expired.status).toBe(401);
    expect(expired.body.message).toBe("Enrollment expired");

    await db().device.update({ where: { id: ids.gateway }, data: { enrollmentExpiresAt: null, estado: false } });
    expect((await call("GET", "/v1/me", { token: tokens.gateway })).status).toBe(401);
  });
});
