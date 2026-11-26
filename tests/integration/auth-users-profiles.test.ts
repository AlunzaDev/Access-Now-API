import express from "express";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorService } from "../../src/api/middlewares/errors/error-handler";
import { bcryptPlugin } from "../../src/config/plugins/bcrypt.plugin";
import { PostgresDatabase } from "../../src/infrastructure/prisma/postgres.database";
import { AppRoutes } from "../../src/presentation/routes/routes";

// /api/auth, /api/usuarios and /api/perfiles-permisos end to end against the test database.
const db = () => PostgresDatabase.client;
const tag = `auth-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Secreta123";
const correo = (name: string) => `${name}-${tag}@example.test`;
let server: Server;
let base = "";

type Json = Record<string, any>;

const call = async (method: string, path: string, { body, token }: { body?: unknown; token?: string } = {}) => {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: (text.startsWith("{") ? JSON.parse(text) : text) as Json };
};

const login = (name: string, password = PASSWORD) => call("POST", "/auth/login", { body: { correo: correo(name), password } });

/** Every error follows docs/contrato-api.md. */
const expectApiError = (response: { status: number; body: Json }, status: number) => {
  expect(response.status).toBe(status);
  expect(response.body).toMatchObject({ ok: false, statusCode: status });
  expect(typeof response.body.message).toBe("string");
  expect(response.body).toHaveProperty("details");
};

describe("auth, usuarios y perfiles", () => {
  let superToken = "";
  let profileId = "";

  beforeAll(async () => {
    await PostgresDatabase.connect({ databaseUrl: process.env.DATABASE_URL!, poolMax: 4 });
    await db().user.create({
      data: { nombre: "Super", apellido: tag, correo: correo("super"), rol: "SUPER_ROLE", password: bcryptPlugin.hash(PASSWORD) },
    });
    const app = express();
    app.use(express.json());
    app.use(AppRoutes.routes);
    app.use(ErrorService.middleware);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await db().user.deleteMany({ where: { apellido: tag } });
    await db().permissionProfile.deleteMany({ where: { nombre: { startsWith: tag } } });
    await PostgresDatabase.disconnect();
  });

  it("rejects wrong credentials, missing tokens and unknown routes with the error contract", async () => {
    expectApiError(await login("super", "Incorrecta1"), 401);
    expectApiError(await login("nadie"), 401);
    expectApiError(await call("GET", "/usuarios"), 401);
    expectApiError(await call("GET", "/usuarios", { token: "no-es-un-jwt" }), 401);
    expectApiError(await call("GET", "/no-existe"), 404);
  });

  it("logs a super admin in with every module and no password in the answer", async () => {
    const { status, body } = await login("super");
    expect(status).toBe(200);
    expect(body.usuario.rol).toBe("SUPER_ROLE");
    expect(body.usuario.modules).toEqual(["users", "permissionProfiles", "projects", "events", "tickets", "scanners", "orders"]);
    expect(body.usuario.password).toBeUndefined();
    superToken = body.token;

    const renewed = await call("GET", "/auth/renew", { token: superToken });
    expect(renewed.status).toBe(200);
    expect(typeof renewed.body.token).toBe("string");
  });

  it("creates permission profiles and validates their modules and fields", async () => {
    expectApiError(
      await call("POST", "/perfiles-permisos", { token: superToken, body: { nombre: `${tag}-malo`, modules: ["events", "parkings"] } }),
      400,
    );
    expectApiError(
      await call("POST", "/perfiles-permisos", { token: superToken, body: { nombre: `${tag}-x`, modules: ["events"], app: "WEB" } }),
      400,
    );

    const created = await call("POST", "/perfiles-permisos", {
      token: superToken,
      body: { nombre: `${tag}-taquilla`, modules: ["events", "tickets", "events"] },
    });
    expect(created.status).toBe(201);
    expect(created.body.modules).toEqual(["events", "tickets"]);
    profileId = created.body.id;

    expectApiError(
      await call("POST", "/perfiles-permisos", { token: superToken, body: { nombre: `${tag}-taquilla`, modules: ["events"] } }),
      409,
    );

    const modules = await call("GET", "/perfiles-permisos/modulos", { token: superToken });
    expect(modules.body.items).toContain("tickets");
  });

  it("creates admins only with an active profile, a valid password and known fields", async () => {
    const base = { nombre: "Ana", apellido: tag, correo: correo("ana"), password: PASSWORD };
    expectApiError(await call("POST", "/usuarios", { token: superToken, body: base }), 400);
    expectApiError(
      await call("POST", "/usuarios", { token: superToken, body: { ...base, password: "corta", permissionProfileId: profileId } }),
      400,
    );
    expectApiError(
      await call("POST", "/usuarios", { token: superToken, body: { ...base, permissionProfileId: profileId, admin: true } }),
      400,
    );

    const created = await call("POST", "/usuarios", { token: superToken, body: { ...base, permissionProfileId: profileId } });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ rol: "ADMIN_ROLE", permissionProfileId: profileId, estado: true });
    expect(created.body.password).toBeUndefined();

    expectApiError(await call("POST", "/usuarios", { token: superToken, body: { ...base, permissionProfileId: profileId } }), 409);
  });

  it("lists users as { items, total } with desde, limite and buscar", async () => {
    const all = await call("GET", `/usuarios?buscar=${tag}`, { token: superToken });
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(2);
    expect(all.body.items).toHaveLength(2);

    const page = await call("GET", `/usuarios?buscar=${tag}&desde=1&limite=1`, { token: superToken });
    expect(page.body.total).toBe(2);
    expect(page.body.items).toHaveLength(1);
    expect(page.body.items[0].password).toBeUndefined();

    const none = await call("GET", "/usuarios?buscar=no-existe-nadie", { token: superToken });
    expect(none.body).toEqual({ items: [], total: 0 });
  });

  it("limits an admin to the modules of its profile", async () => {
    const { status, body } = await login("ana");
    expect(status).toBe(200);
    expect(body.usuario.modules).toEqual(["events", "tickets"]);

    expectApiError(await call("GET", "/usuarios", { token: body.token }), 403);
    expectApiError(await call("GET", "/perfiles-permisos", { token: body.token }), 403);
  });

  it("keeps a profile in use and cuts access as soon as it is deactivated", async () => {
    const anaToken = (await login("ana")).body.token;

    expectApiError(await call("DELETE", `/perfiles-permisos/${profileId}`, { token: superToken }), 409);

    const off = await call("PATCH", `/perfiles-permisos/${profileId}`, { token: superToken, body: { estado: false } });
    expect(off.status).toBe(200);
    expectApiError(await call("GET", "/auth/renew", { token: anaToken }), 403);
    expectApiError(await login("ana"), 403);

    await call("PATCH", `/perfiles-permisos/${profileId}`, { token: superToken, body: { estado: true } });
    expect((await call("GET", "/auth/renew", { token: anaToken })).status).toBe(200);
  });

  it("blocks deactivated users and protects super admins", async () => {
    const ana = await db().user.findUniqueOrThrow({ where: { correo: correo("ana") } });
    const superUser = await db().user.findUniqueOrThrow({ where: { correo: correo("super") } });

    await db().permissionProfile.update({ where: { id: profileId }, data: { modules: ["users", "events"] } });
    const anaToken = (await login("ana")).body.token;

    expectApiError(await call("PATCH", `/usuarios/${ana.id}`, { token: anaToken, body: { rol: "SUPER_ROLE" } }), 403);
    // A super admin has no projects, so an admin does not even see it.
    expectApiError(await call("PATCH", `/usuarios/${superUser.id}`, { token: anaToken, body: { nombre: "Otro" } }), 404);
    expectApiError(await call("DELETE", `/usuarios/${superUser.id}`, { token: anaToken }), 403);
    expectApiError(await call("PATCH", `/usuarios/${superUser.id}`, { token: superToken, body: { estado: false } }), 400);

    const off = await call("PATCH", `/usuarios/${ana.id}`, { token: superToken, body: { estado: false } });
    expect(off.status).toBe(200);
    expectApiError(await call("GET", "/auth/renew", { token: anaToken }), 403);
  });

  it("answers forgot-password the same way for unknown accounts and rejects bad reset tokens", async () => {
    expect((await call("POST", "/auth/forgot-password", { body: { correo: correo("nadie") } })).status).toBe(200);
    expect((await call("GET", "/auth/reset-password/no-existe")).status).toBe(400);
    expectApiError(await call("POST", "/auth/reset-password", { body: { token: "no-existe", newPassword: PASSWORD } }), 401);
  });
});
