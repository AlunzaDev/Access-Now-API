import express from "express";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorService } from "../../src/api/middlewares/errors/error-handler";
import { bcryptPlugin } from "../../src/config/plugins/bcrypt.plugin";
import { PostgresDatabase } from "../../src/infrastructure/prisma/postgres.database";
import { AppRoutes } from "../../src/presentation/routes/routes";

// Permission "Ver historial" (module `history`): the immutable history of tickets and devices is
// only sent to who has it, not just hidden in the screen.
type Json = Record<string, any>;

const db = () => PostgresDatabase.client;
const tag = `his-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Secreta123";
const correo = (name: string) => `${name}-${tag}@example.test`;
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
  return { status: response.status, body: (await response.json()) as Json };
};

const login = async (name: string) =>
  (await call("POST", "/auth/login", { body: { correo: correo(name), password: PASSWORD } })).body as {
    token: string;
    usuario: Json;
  };

describe("permiso Ver historial", () => {
  const ids = { project: "", ticket: "", gateway: "" };
  const tokens = { conHistorial: "", sinHistorial: "", super: "" };

  beforeAll(async () => {
    await PostgresDatabase.connect({ databaseUrl: process.env.DATABASE_URL!, poolMax: 4 });
    ids.project = (await db().project.create({ data: { nombre: tag, clave: tag.toUpperCase() } })).id;
    const profile = async (name: string, modules: ("tickets" | "scanners" | "history")[]) =>
      (await db().permissionProfile.create({ data: { nombre: `${tag}-${name}`, modules } })).id;
    const user = async (name: string, rol: "ADMIN_ROLE" | "SUPER_ROLE", permissionProfileId?: string) =>
      db().user.create({
        data: {
          nombre: name,
          apellido: tag,
          correo: correo(name),
          rol,
          password: bcryptPlugin.hash(PASSWORD),
          permissionProfileId,
          projects: rol === "ADMIN_ROLE" ? { create: { projectId: ids.project } } : undefined,
        },
      });
    await user("con", "ADMIN_ROLE", await profile("con", ["tickets", "scanners", "history"]));
    await user("sin", "ADMIN_ROLE", await profile("sin", ["tickets", "scanners"]));
    await user("super", "SUPER_ROLE");

    const event = await db().event.create({
      data: {
        projectId: ids.project,
        nombre: "Evento",
        fechaInicio: new Date("2026-12-01T00:00:00Z"),
        fechaFin: new Date("2026-12-01T00:00:00Z"),
        horaInicio: "10:00",
        horaFin: "20:00",
      },
    });
    ids.ticket = (
      await db().ticket.create({
        data: {
          projectId: ids.project,
          eventId: event.id,
          folio: `AN-${tag.toUpperCase()}`,
          history: { create: { tipo: "GENERADO" } },
        },
      })
    ).id;
    ids.gateway = (
      await db().device.create({ data: { projectId: ids.project, tipo: "GATEWAY", nombre: "GW", ip: "10.6.0.1" } })
    ).id;

    const app = express();
    app.use(express.json());
    app.use(AppRoutes.routes);
    app.use(ErrorService.middleware);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    tokens.conHistorial = (await login("con")).token;
    tokens.sinHistorial = (await login("sin")).token;
    tokens.super = (await login("super")).token;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await db().project.deleteMany({ where: { id: ids.project } });
    await db().user.deleteMany({ where: { apellido: tag } });
    await db().permissionProfile.deleteMany({ where: { nombre: { startsWith: tag } } });
    await PostgresDatabase.disconnect();
  });

  it("sends the ticket history only to who has the permission", async () => {
    const path = `/proyectos/${ids.project}/boletos/${ids.ticket}`;
    const without = await call("GET", path, { token: tokens.sinHistorial });
    expect(without.status).toBe(200);
    expect(without.body).not.toHaveProperty("historial");

    const withIt = await call("GET", path, { token: tokens.conHistorial });
    expect(withIt.body.historial.map((item: Json) => item.tipo)).toEqual(["GENERADO"]);
    expect((await call("GET", path, { token: tokens.super })).body.historial).toHaveLength(1);
  });

  it("closes the device history to who lacks it", async () => {
    const path = `/proyectos/${ids.project}/dispositivos/${ids.gateway}/historial`;
    expect((await call("GET", path, { token: tokens.sinHistorial })).status).toBe(403);
    expect((await call("GET", path, { token: tokens.conHistorial })).status).toBe(200);
    // The rest of the device stays available.
    expect((await call("GET", `/proyectos/${ids.project}/dispositivos/${ids.gateway}/estado`, { token: tokens.sinHistorial })).status)
      .toBe(200);
  });

  it("lists the permission among the modules a profile can have", async () => {
    expect((await login("con")).usuario.modules).toContain("history");
    expect((await login("super")).usuario.modules).toContain("history");
    const modules = await call("GET", "/perfiles-permisos/modulos", { token: tokens.super });
    expect(modules.body.items).toContain("history");
  });
});
