import express from "express";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bcryptPlugin } from "../../src/config/plugins/bcrypt.plugin";
import { PostgresDatabase } from "../../src/data/postgres";
import { AppRoutes } from "../../src/presentation/routes/routes";

// /api/auth, /api/usuarios and /api/permission-profiles end to end against the test database.
const db = () => PostgresDatabase.client;
const tag = `auth-${randomUUID().slice(0, 8)}`;
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
  const text = await response.text();
  return { status: response.status, body: (text.startsWith("{") ? JSON.parse(text) : text) as Record<string, any> };
};

const login = async (name: string, password = PASSWORD) =>
  call("POST", "/auth/login", { body: { correo: correo(name), password } });

describe("auth, usuarios y perfiles", () => {
  let superToken = "";
  let profileId = "";

  beforeAll(async () => {
    await PostgresDatabase.connect({ databaseUrl: process.env.DATABASE_URL!, poolMax: 4 });
    await db().usuario.create({
      data: { nombre: "Super", apellido: tag, correo: correo("super"), rol: "SUPER_ROLE", password: bcryptPlugin.hash(PASSWORD) },
    });
    const app = express();
    app.use(express.json());
    app.use(AppRoutes.routes);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await db().usuario.deleteMany({ where: { apellido: tag } });
    await db().permissionProfile.deleteMany({ where: { nombre: { startsWith: tag } } });
    await PostgresDatabase.disconnect();
  });

  it("rejects wrong credentials and requests without a token", async () => {
    expect((await login("super", "Incorrecta1")).status).toBe(401);
    expect((await login("nadie")).status).toBe(401);
    expect((await call("GET", "/usuarios")).status).toBe(401);
    expect((await call("GET", "/usuarios", { token: "no-es-un-jwt" })).status).toBe(401);
  });

  it("logs a super admin in with every module and no password in the answer", async () => {
    const { status, body } = await login("super");
    expect(status).toBe(200);
    expect(body.usuario.rol).toBe("SUPER_ROLE");
    expect(body.usuario.modules).toEqual(["users", "permissionProfiles", "events", "tickets", "scanners", "orders"]);
    expect(body.usuario.password).toBeUndefined();
    superToken = body.token;

    const renewed = await call("GET", "/auth/renew", { token: superToken });
    expect(renewed.status).toBe(200);
    expect(typeof renewed.body.token).toBe("string");
  });

  it("creates permission profiles and validates their modules", async () => {
    const invalid = await call("POST", "/permission-profiles", {
      token: superToken,
      body: { nombre: `${tag}-malo`, modules: ["events", "parkings"] },
    });
    expect(invalid.status).toBe(400);

    const created = await call("POST", "/permission-profiles", {
      token: superToken,
      body: { nombre: `${tag}-taquilla`, modules: ["events", "tickets", "events"] },
    });
    expect(created.status).toBe(201);
    expect(created.body.profile.modules).toEqual(["events", "tickets"]);
    profileId = created.body.profile.id;

    const duplicate = await call("POST", "/permission-profiles", {
      token: superToken,
      body: { nombre: `${tag}-taquilla`, modules: ["events"] },
    });
    expect(duplicate.status).toBe(400);
  });

  it("creates admins only with an active profile and a valid password", async () => {
    const base = { nombre: "Ana", apellido: tag, correo: correo("ana"), password: PASSWORD };
    expect((await call("POST", "/usuarios", { token: superToken, body: base })).status).toBe(400);
    expect(
      (await call("POST", "/usuarios", { token: superToken, body: { ...base, password: "corta", permissionProfileId: profileId } }))
        .status,
    ).toBe(400);

    const created = await call("POST", "/usuarios", { token: superToken, body: { ...base, permissionProfileId: profileId } });
    expect(created.status).toBe(201);
    expect(created.body.usuario).toMatchObject({ rol: "ADMIN_ROLE", permissionProfileId: profileId, estado: true });
    expect(created.body.usuario.password).toBeUndefined();

    const again = await call("POST", "/usuarios", { token: superToken, body: { ...base, permissionProfileId: profileId } });
    expect(again.status).toBe(400);
  });

  it("limits an admin to the modules of its profile", async () => {
    const { status, body } = await login("ana");
    expect(status).toBe(200);
    expect(body.usuario.modules).toEqual(["events", "tickets"]);
    const anaToken = body.token;

    expect((await call("GET", "/usuarios", { token: anaToken })).status).toBe(403);
    expect((await call("GET", "/permission-profiles", { token: anaToken })).status).toBe(403);
  });

  it("keeps a profile in use and cuts access as soon as it is deactivated", async () => {
    const anaToken = (await login("ana")).body.token;

    expect((await call("DELETE", `/permission-profiles/${profileId}`, { token: superToken })).status).toBe(409);

    const off = await call("PATCH", `/permission-profiles/${profileId}`, { token: superToken, body: { estado: false } });
    expect(off.status).toBe(200);
    expect((await call("GET", "/auth/renew", { token: anaToken })).status).toBe(403);
    expect((await login("ana")).status).toBe(403);

    await call("PATCH", `/permission-profiles/${profileId}`, { token: superToken, body: { estado: true } });
    expect((await call("GET", "/auth/renew", { token: anaToken })).status).toBe(200);
  });

  it("blocks deactivated users and protects super admins", async () => {
    const ana = await db().usuario.findUniqueOrThrow({ where: { correo: correo("ana") } });
    const superUser = await db().usuario.findUniqueOrThrow({ where: { correo: correo("super") } });

    await db().permissionProfile.update({ where: { id: profileId }, data: { modules: ["users", "events"] } });
    const anaToken = (await login("ana")).body.token;

    const promote = await call("PATCH", `/usuarios/${ana.id}`, { token: anaToken, body: { rol: "SUPER_ROLE" } });
    expect(promote.status).toBe(403);
    const touchSuper = await call("PATCH", `/usuarios/${superUser.id}`, { token: anaToken, body: { nombre: "Otro" } });
    expect(touchSuper.status).toBe(403);
    expect((await call("DELETE", `/usuarios/${superUser.id}`, { token: anaToken })).status).toBe(403);

    const selfOff = await call("PATCH", `/usuarios/${superUser.id}`, { token: superToken, body: { estado: false } });
    expect(selfOff.status).toBe(400);

    const off = await call("PATCH", `/usuarios/${ana.id}`, { token: superToken, body: { estado: false } });
    expect(off.status).toBe(200);
    expect((await call("GET", "/auth/renew", { token: anaToken })).status).toBe(403);
  });

  it("answers forgot-password the same way for unknown accounts and rejects bad reset tokens", async () => {
    const unknown = await call("POST", "/auth/forgot-password", { body: { correo: correo("nadie") } });
    expect(unknown.status).toBe(200);

    const page = await call("GET", "/auth/reset-password/no-existe");
    expect(page.status).toBe(400);

    const reset = await call("POST", "/auth/reset-password", { body: { token: "no-existe", newPassword: PASSWORD } });
    expect(reset.status).toBe(401);
  });
});
