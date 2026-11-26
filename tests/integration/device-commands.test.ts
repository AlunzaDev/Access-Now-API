import express from "express";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorService } from "../../src/api/middlewares/errors/error-handler";
import { bcryptPlugin } from "../../src/config/plugins/bcrypt.plugin";
import { PostgresDatabase } from "../../src/infrastructure/prisma/postgres.database";
import { AppRoutes } from "../../src/presentation/routes/routes";

// Command queue: the dashboard queues, the heartbeat answer delivers, the next heartbeat reports.
type Json = Record<string, any>;

const db = () => PostgresDatabase.client;
const tag = `cmd-${randomUUID().slice(0, 8)}`;
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

describe("cola de comandos por heartbeat y terminales por MAC", () => {
  const ids = { project: "", gateway: "", terminal: "" };
  const tokens = { user: "", gateway: "" };
  const devices = () => `/proyectos/${ids.project}/dispositivos`;
  const beat = (body: Json = {}) => call("POST", "/v1/device/heartbeat", { token: tokens.gateway, body });
  const terminalRow = (id = ids.terminal) => db().device.findUniqueOrThrow({ where: { id } });

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
      await db().device.create({ data: { projectId: ids.project, tipo: "GATEWAY", nombre: "GW", ip: "10.1.0.2" } })
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

    const enrollmentToken = (
      await call("POST", `${devices()}/${ids.gateway}/token-enrolamiento`, {
        token: tokens.user,
        body: { vigenciaHoras: 1, duracionEnrolamientoDias: null },
      })
    ).body.token;
    tokens.gateway = (
      await call("POST", "/v1/device/enroll", {
        body: { token: enrollmentToken, device_fingerprint: `fp-${tag}`, device_name: "GW" },
      })
    ).body.token;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await db().project.deleteMany({ where: { id: ids.project } });
    await db().user.deleteMany({ where: { apellido: tag } });
    await PostgresDatabase.disconnect();
  });

  it("answers an empty queue and validates what the gateway sends", async () => {
    const empty = await beat();
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ ok: true, intervaloSegundos: 60, comandos: [], resultadosRecibidos: [] });

    expect((await beat({ resultados: [{ id: "x", ok: true }] })).status).toBe(400);
    expect((await beat({ resultados: [{ id: randomUUID(), ok: "si" }] })).status).toBe(400);
    expect((await beat({ terminales: [{ mac: "nope", ip: "10.1.0.9" }] })).status).toBe(400);
    expect((await beat({ terminales: [{ mac: "AA:00:00:00:00:01", ip: "10.1.0.9", otro: 1 }] })).status).toBe(400);
    const repeated = { mac: "AA:00:00:00:00:01", ip: "10.1.0.9" };
    expect((await beat({ terminales: [repeated, repeated] })).status).toBe(400);
  });

  it("queues a new terminal, keeps only the latest change and delivers it once", async () => {
    const created = await call("POST", devices(), {
      token: tokens.user,
      body: {
        tipo: "TERMINAL",
        nombre: "Torniquete A",
        ip: "10.1.0.10",
        mac: "AA:00:00:00:00:10",
        gatewayId: ids.gateway,
        carril: "1",
        sentido: "ENTRADA",
      },
    });
    expect(created.status).toBe(201);
    expect(created.body.configEstado).toBe("PENDIENTE");
    ids.terminal = created.body.id;

    // Edited before the gateway picked it up: the first command is replaced, not stacked.
    await call("PATCH", `${devices()}/${ids.terminal}`, { token: tokens.user, body: { ip: "10.1.0.11" } });
    const queue = await call("GET", `${devices()}/${ids.gateway}/comandos`, { token: tokens.user });
    expect(queue.body.items.map((command: Json) => command.estado)).toEqual(["PENDIENTE", "CANCELADO"]);
    expect(queue.body.items[0].creadoPor.nombre).toContain("Super");

    const answer = await beat();
    expect(answer.body.comandos).toHaveLength(1);
    expect(answer.body.comandos[0]).toMatchObject({
      tipo: "CONFIGURAR_TERMINAL",
      intentos: 1,
      payload: { terminal: { terminalId: ids.terminal, ip: "10.1.0.11", mac: "AA:00:00:00:00:10", carril: "1" } },
    });
    // Delivered and waiting for its result: not sent again on the next heartbeat.
    expect((await beat()).body.comandos).toEqual([]);
  });

  it("closes the command with the result and acknowledges repeats", async () => {
    const [command] = (await call("GET", `${devices()}/${ids.terminal}/comandos`, { token: tokens.user })).body.items;
    const reported = await beat({ resultados: [{ id: command.id, ok: false, error: "ISAPI 401" }] });
    expect(reported.body.resultadosRecibidos).toEqual([command.id]);
    expect(await terminalRow()).toMatchObject({ configEstado: "ERROR", configError: "ISAPI 401" });

    const closed = (await call("GET", `${devices()}/${ids.terminal}/comandos`, { token: tokens.user })).body.items[0];
    expect(closed).toMatchObject({ estado: "ERROR", error: "ISAPI 401", actualizadoPor: { nombre: "Gateway GW" } });

    // A repeated result is acknowledged so the Raspberry stops resending it, and changes nothing.
    const repeated = await beat({ resultados: [{ id: command.id, ok: true }] });
    expect(repeated.body.resultadosRecibidos).toEqual([command.id]);
    expect((await terminalRow()).configEstado).toBe("ERROR");
  });

  it("reapplies a terminal on demand and marks it configured", async () => {
    const reapplied = await call("POST", `${devices()}/${ids.terminal}/sincronizar`, { token: tokens.user });
    expect(reapplied.status).toBe(201);
    expect(reapplied.body).toMatchObject({ tipo: "CONFIGURAR_TERMINAL", estado: "PENDIENTE" });
    expect((await terminalRow()).configEstado).toBe("PENDIENTE");

    const [delivered] = (await beat()).body.comandos;
    await beat({ resultados: [{ id: delivered.id, ok: true }] });
    expect(await terminalRow()).toMatchObject({ configEstado: "CONFIGURADA", configError: "" });
  });

  it("redelivers a command without a result and fails it after too many attempts", async () => {
    const { id } = (await call("POST", `${devices()}/${ids.terminal}/sincronizar`, { token: tokens.user })).body;
    expect((await beat()).body.comandos[0].id).toBe(id);

    // The answer got lost: once the retry time passes it travels again.
    await db().deviceCommand.update({ where: { id }, data: { entregadoEn: new Date(Date.now() - 10 * 60 * 1000) } });
    const retried = (await beat()).body.comandos[0];
    expect(retried).toMatchObject({ id, intentos: 2 });

    await db().deviceCommand.update({
      where: { id },
      data: { intentos: 5, entregadoEn: new Date(Date.now() - 10 * 60 * 1000) },
    });
    expect((await beat()).body.comandos).toEqual([]);
    expect(await db().deviceCommand.findUniqueOrThrow({ where: { id } })).toMatchObject({ estado: "ERROR" });
    expect((await terminalRow()).configEstado).toBe("ERROR");
  });

  it("cancels only pending commands", async () => {
    const { id } = (await call("POST", `${devices()}/${ids.terminal}/sincronizar`, { token: tokens.user })).body;
    const cancelled = await call("POST", `${devices()}/${ids.terminal}/comandos/${id}/cancelar`, { token: tokens.user });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({ estado: "CANCELADO", actualizadoPor: { nombre: expect.stringContaining("Super") } });
    expect((await terminalRow()).configEstado).toBe("ERROR");
    expect((await call("POST", `${devices()}/${ids.terminal}/comandos/${id}/cancelar`, { token: tokens.user })).status)
      .toBe(409);
    expect((await call("POST", `${devices()}/${ids.terminal}/comandos/${randomUUID()}/cancelar`, { token: tokens.user })).status)
      .toBe(404);
  });

  it("removes a deactivated terminal from the gateway and marks it RETIRADA", async () => {
    await call("PATCH", `${devices()}/${ids.terminal}`, { token: tokens.user, body: { estado: false } });
    const [command] = (await beat()).body.comandos;
    expect(command).toMatchObject({ tipo: "ELIMINAR_TERMINAL", payload: { terminal: { mac: "AA:00:00:00:00:10" } } });
    await beat({ resultados: [{ id: command.id, ok: true }] });
    expect((await terminalRow()).configEstado).toBe("RETIRADA");

    expect((await call("POST", `${devices()}/${ids.terminal}/sincronizar`, { token: tokens.user })).status).toBe(409);
    await call("PATCH", `${devices()}/${ids.terminal}`, { token: tokens.user, body: { estado: true } });
    expect((await beat()).body.comandos[0].tipo).toBe("CONFIGURAR_TERMINAL");
  });

  it("syncs the whole gateway with per-terminal results", async () => {
    const sync = await call("POST", `${devices()}/${ids.gateway}/sincronizar`, { token: tokens.user });
    expect(sync.status).toBe(201);
    expect(sync.body.payload.terminales.map((terminal: Json) => terminal.mac)).toEqual(["AA:00:00:00:00:10"]);

    const delivered = (await beat()).body.comandos.find((command: Json) => command.tipo === "SINCRONIZAR");
    const pendingConfigure = (await call("GET", `${devices()}/${ids.terminal}/comandos`, { token: tokens.user })).body
      .items.find((command: Json) => command.tipo === "CONFIGURAR_TERMINAL" && command.estado === "ENTREGADO");
    await beat({
      resultados: [
        { id: pendingConfigure.id, ok: true },
        { id: delivered.id, ok: true, datos: { terminales: [{ mac: "AA:00:00:00:00:10", ok: true }] } },
      ],
    });
    expect((await terminalRow()).configEstado).toBe("CONFIGURADA");
  });

  it("learns terminals by MAC from the report and tracks their presence", async () => {
    const report = await beat({
      terminales: [
        { mac: "aa-00-00-00-00-10", ip: "10.1.0.50", modelo: "DS-K3B501" },
        { mac: "AA:00:00:00:00:99", ip: "10.1.0.99", enLinea: true },
      ],
    });
    expect(report.status).toBe(200);
    // Known MAC: the IP the gateway sees wins (DHCP may have changed it).
    expect(await terminalRow()).toMatchObject({ ip: "10.1.0.50", modelo: "DS-K3B501", enLinea: true });

    const detected = await db().device.findFirstOrThrow({ where: { projectId: ids.project, mac: "AA:00:00:00:00:99" } });
    expect(detected).toMatchObject({
      tipo: "TERMINAL",
      gatewayId: ids.gateway,
      configEstado: "CONFIGURADA",
      creadoPorNombre: "Gateway GW",
    });
    const history = await call("GET", `${devices()}/${detected.id}/historial`, { token: tokens.user });
    expect(history.body.items[0]).toMatchObject({ tipo: "TERMINAL_DETECTADA", actor: { nombre: "Gateway GW" } });

    const status = await call("GET", `${devices()}/${detected.id}/estado`, { token: tokens.user });
    expect(status.body).toMatchObject({ enLinea: true });

    // A full report without it: the terminal is no longer reachable.
    await beat({ terminales: [{ mac: "AA:00:00:00:00:10", ip: "10.1.0.50" }] });
    expect((await terminalRow(detected.id)).enLinea).toBe(false);
  });

  it("keeps the payload to remove a deleted terminal", async () => {
    const detected = await db().device.findFirstOrThrow({ where: { projectId: ids.project, mac: "AA:00:00:00:00:99" } });
    expect((await call("DELETE", `${devices()}/${detected.id}`, { token: tokens.user })).status).toBe(200);
    const [command] = (await beat()).body.comandos;
    expect(command).toMatchObject({ tipo: "ELIMINAR_TERMINAL", payload: { terminal: { mac: "AA:00:00:00:00:99" } } });
    expect(await db().deviceCommand.findUniqueOrThrow({ where: { id: command.id } })).toMatchObject({ terminalId: null });
  });
});
