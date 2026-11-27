import express from "express";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorService } from "../../src/api/middlewares/errors/error-handler";
import { bcryptPlugin } from "../../src/config/plugins/bcrypt.plugin";
import { PostgresDatabase } from "../../src/infrastructure/prisma/postgres.database";
import { AppRoutes } from "../../src/presentation/routes/routes";

// Hardening of /api/v1: fingerprint on every call, security alerts, revocation and attempt limits.
type Json = Record<string, any>;

const db = () => PostgresDatabase.client;
const tag = `sec-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Secreta123";
let server: Server;
let baseUrl = "";

const call = async (
  method: string,
  path: string,
  { body, token, fingerprint }: { body?: unknown; token?: string; fingerprint?: string } = {},
) => {
  const response = await fetch(`${baseUrl}/api${path}`, {
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

describe("acceso de gateways endurecido", () => {
  const ids = { project: "", gateway: "", other: "" };
  let userToken = "";
  const devices = () => `/proyectos/${ids.project}/dispositivos`;
  const history = async (id: string) =>
    (await call("GET", `${devices()}/${id}/historial`, { token: userToken })).body.items as Json[];

  /** Enrolls a gateway and returns its operational token. */
  const enroll = async (gatewayId: string, fingerprint: string) => {
    const enrollmentToken = (
      await call("POST", `${devices()}/${gatewayId}/token-enrolamiento`, {
        token: userToken,
        body: { vigenciaHoras: 1, duracionEnrolamientoDias: null },
      })
    ).body.token;
    return (
      await call("POST", "/v1/device/enroll", {
        body: { token: enrollmentToken, device_fingerprint: fingerprint, device_name: "GW" },
      })
    ).body.token as string;
  };

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
    const gateway = (nombre: string) =>
      db().device.create({ data: { projectId: ids.project, tipo: "GATEWAY", nombre, ip: "10.2.0.2" } });
    ids.gateway = (await gateway("Puerta 1")).id;
    ids.other = (await gateway("Puerta 2")).id;

    const app = express();
    app.use(express.json());
    app.use(AppRoutes.routes);
    app.use(ErrorService.middleware);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    userToken = (
      await call("POST", "/auth/login", { body: { correo: `super-${tag}@example.test`, password: PASSWORD } })
    ).body.token;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await db().project.deleteMany({ where: { id: ids.project } });
    await db().user.deleteMany({ where: { apellido: tag } });
    await PostgresDatabase.disconnect();
  });

  it("requires the enrolled fingerprint and alerts once about a copied token", async () => {
    const token = await enroll(ids.gateway, "pi-serial-001");
    expect((await call("GET", "/v1/me", { token, fingerprint: "pi-serial-001" })).status).toBe(200);

    const missing = await call("GET", "/v1/me", { token });
    expect(missing).toMatchObject({ status: 401, body: { message: "Device fingerprint required" } });

    const copied = await call("POST", "/v1/device/heartbeat", { token, fingerprint: "pi-serial-999", body: {} });
    expect(copied).toMatchObject({ status: 401, body: { message: "Device fingerprint mismatch" } });
    await call("GET", "/v1/me", { token, fingerprint: "pi-serial-999" });

    const alerts = (await history(ids.gateway)).filter((event) => event.tipo === "ALERTA_SEGURIDAD");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ detalle: { motivo: "HUELLA_DISTINTA" }, actor: { nombre: "Sistema" } });
  });

  it("alerts when the same token reports from another address while online", async () => {
    const token = await enroll(ids.other, "pi-serial-002");
    await call("POST", "/v1/device/heartbeat", { token, fingerprint: "pi-serial-002", body: {} });
    // Another place reported a moment ago with the same token.
    await db().device.update({
      where: { id: ids.other },
      data: { ultimaIpOrigen: "203.0.113.9", ultimaConexion: new Date() },
    });
    await call("POST", "/v1/device/heartbeat", { token, fingerprint: "pi-serial-002", body: {} });

    const alert = (await history(ids.other)).find((event) => event.tipo === "ALERTA_SEGURIDAD");
    expect(alert?.detalle).toMatchObject({ motivo: "IP_ORIGEN_SIMULTANEA", ipAnterior: "203.0.113.9" });
  });

  it("revokes an enrollment without deleting or deactivating the gateway", async () => {
    const token = await enroll(ids.other, "pi-serial-002");
    const revoked = await call("POST", `${devices()}/${ids.other}/revocar-enrolamiento`, { token: userToken });
    expect(revoked.status).toBe(200);
    expect(revoked.body).toMatchObject({ estado: true, enrolado: false, enLinea: false });

    expect((await call("GET", "/v1/me", { token, fingerprint: "pi-serial-002" })).status).toBe(401);
    // It reported a moment ago, but without an enrollment it is not online.
    const status = await call("GET", `${devices()}/${ids.other}/estado`, { token: userToken });
    expect(status.body).toMatchObject({ enLinea: false, enrolamiento: null });
    const [event] = await history(ids.other);
    expect(event).toMatchObject({ tipo: "REVOCADO", actor: { nombre: expect.stringContaining("Super") } });

    expect((await call("POST", `${devices()}/${ids.other}/revocar-enrolamiento`, { token: userToken })).status).toBe(409);
    // An unused enrollment token can be revoked too.
    await call("POST", `${devices()}/${ids.other}/token-enrolamiento`, { token: userToken, body: { vigenciaHoras: 1 } });
    expect((await call("POST", `${devices()}/${ids.other}/revocar-enrolamiento`, { token: userToken })).status).toBe(200);
  });

  it("caps failed enrollment and token attempts per address", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await call("POST", "/v1/device/enroll", { body: { token: "nope", device_fingerprint: "x", device_name: "x" } });
    }
    const blocked = await call("POST", "/v1/device/enroll", { body: { token: "nope", device_fingerprint: "x", device_name: "x" } });
    expect(blocked.status).toBe(429);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await call("GET", "/v1/me", { token: "b".repeat(64), fingerprint: "x" });
    }
    expect((await call("GET", "/v1/me", { token: "b".repeat(64), fingerprint: "x" })).status).toBe(429);
  });
});
