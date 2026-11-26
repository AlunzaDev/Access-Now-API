import express from "express";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorService } from "../../src/api/middlewares/errors/error-handler";
import { bcryptPlugin } from "../../src/config/plugins/bcrypt.plugin";
import { PostgresDatabase } from "../../src/infrastructure/prisma/postgres.database";
import { AppRoutes } from "../../src/presentation/routes/routes";

// /api/proyectos and project scoping of /api/usuarios, against the test database.
const db = () => PostgresDatabase.client;
const tag = `prj-${randomUUID().slice(0, 8)}`;
const TAG = tag.toUpperCase();
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

const uploadImage = async (projectId: string, token: string, file: Blob, filename: string) => {
  const form = new FormData();
  form.set("imagen", file, filename);
  const response = await fetch(`${base}/api/proyectos/${projectId}/imagen`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: response.status, body: (await response.json()) as Json };
};

const login = async (name: string) => {
  const { body } = await call("POST", "/auth/login", { body: { correo: correo(name), password: PASSWORD } });
  return body as { token: string; usuario: Json };
};

describe("proyectos y acceso por proyecto", () => {
  const tokens = { super: "", admin: "" };
  const ids = { norte: "", sur: "", otro: "", profile: "", admin: "" };

  beforeAll(async () => {
    await PostgresDatabase.connect({ databaseUrl: process.env.DATABASE_URL!, poolMax: 4 });
    await db().user.create({
      data: { nombre: "Super", apellido: tag, correo: correo("super"), rol: "SUPER_ROLE", password: bcryptPlugin.hash(PASSWORD) },
    });
    ids.profile = (
      await db().permissionProfile.create({ data: { nombre: `${tag}-gerente`, modules: ["users", "projects", "events"] } })
    ).id;
    const app = express();
    app.use(express.json());
    app.use(AppRoutes.routes);
    app.use(ErrorService.middleware);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    tokens.super = (await login("super")).token;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await db().user.deleteMany({ where: { apellido: tag } });
    await db().project.deleteMany({ where: { clave: { startsWith: TAG } } });
    await db().permissionProfile.deleteMany({ where: { nombre: { startsWith: tag } } });
    await PostgresDatabase.disconnect();
  });

  it("lets a super admin create projects with a normalized, unique clave", async () => {
    const norte = await call("POST", "/proyectos", {
      token: tokens.super,
      body: { nombre: "Estadio Norte", clave: `${tag} norte`, ciudad: "Monterrey", latitud: 25.6866, longitud: -100.3161 },
    });
    expect(norte.status).toBe(201);
    expect(norte.body).toMatchObject({ clave: `${TAG}-NORTE`, ciudad: "Monterrey", estado: true, latitud: 25.6866, longitud: -100.3161 });
    ids.norte = norte.body.id;

    ids.sur = (await call("POST", "/proyectos", { token: tokens.super, body: { nombre: "Arena Sur", clave: `${tag}-sur` } })).body.id;
    ids.otro = (await call("POST", "/proyectos", { token: tokens.super, body: { nombre: "Otro", clave: `${tag}-otro` } })).body.id;

    const duplicate = await call("POST", "/proyectos", { token: tokens.super, body: { nombre: "X", clave: `${TAG}-NORTE` } });
    expect(duplicate.status).toBe(409);
    expect((await call("POST", "/proyectos", { token: tokens.super, body: { nombre: "Sin clave" } })).status).toBe(400);
  });

  it("validates and updates project location as a complete pair", async () => {
    const updated = await call("PATCH", `/proyectos/${ids.norte}`, {
      token: tokens.super,
      body: { latitud: 19.4326, longitud: -99.1332 },
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ latitud: 19.4326, longitud: -99.1332 });

    const incomplete = await call("PATCH", `/proyectos/${ids.norte}`, { token: tokens.super, body: { latitud: 20 } });
    expect(incomplete.status).toBe(400);
    expect(incomplete.body).toMatchObject({ ok: false, statusCode: 400, details: null });

    const cleared = await call("PATCH", `/proyectos/${ids.norte}`, { token: tokens.super, body: { latitud: null, longitud: null } });
    expect(cleared.body).toMatchObject({ latitud: null, longitud: null });
  });

  it("uploads, replaces and deletes a local project image", async () => {
    const first = await uploadImage(ids.norte, tokens.super, new Blob(["first"], { type: "image/png" }), "first.png");
    expect(first.status).toBe(200);
    expect(first.body.img).toMatch(new RegExp(`/uploads/proyectos/${ids.norte}/[0-9a-f-]+\\.png$`));
    const firstUrl = first.body.img as string;
    const firstPath = resolve(process.cwd(), "public", new URL(firstUrl, "http://local").pathname.replace(/^\/uploads\//, "uploads/"));
    expect(existsSync(firstPath)).toBe(true);

    const second = await uploadImage(ids.norte, tokens.super, new Blob(["second"], { type: "image/webp" }), "second.webp");
    expect(second.status).toBe(200);
    expect(second.body.img).toMatch(/\.webp$/);
    expect(second.body.img).not.toBe(firstUrl);
    const secondPath = resolve(process.cwd(), "public", new URL(second.body.img as string, "http://local").pathname.replace(/^\/uploads\//, "uploads/"));
    expect(existsSync(firstPath)).toBe(false);
    expect(existsSync(secondPath)).toBe(true);

    const invalid = await uploadImage(ids.norte, tokens.super, new Blob(["text"], { type: "text/plain" }), "bad.txt");
    expect(invalid.status).toBe(400);
    expect(invalid.body).toMatchObject({ ok: false, statusCode: 400, details: null });

    const oversized = await uploadImage(ids.norte, tokens.super, new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/jpeg" }), "large.jpg");
    expect(oversized.status).toBe(413);
    expect(oversized.body).toMatchObject({ ok: false, statusCode: 413, details: null });

    const removed = await call("DELETE", `/proyectos/${ids.norte}/imagen`, { token: tokens.super });
    expect(removed.status).toBe(200);
    expect(removed.body.img).toBe("");
    expect(existsSync(secondPath)).toBe(false);
  });

  it("returns every project in a super admin's session", async () => {
    const { usuario } = await login("super");
    const mine = usuario.proyectos.map((project: Json) => project.id);
    expect(mine).toEqual(expect.arrayContaining([ids.norte, ids.sur, ids.otro]));
  });

  it("creates an admin assigned to projects and returns only them in its session", async () => {
    const created = await call("POST", "/usuarios", {
      token: tokens.super,
      body: {
        nombre: "Gerente",
        apellido: tag,
        correo: correo("gerente"),
        password: PASSWORD,
        permissionProfileId: ids.profile,
        proyectoIds: [ids.norte, ids.sur],
      },
    });
    expect(created.status).toBe(201);
    expect([...created.body.proyectoIds].sort()).toEqual([ids.norte, ids.sur].sort());
    ids.admin = created.body.id;

    const session = await login("gerente");
    tokens.admin = session.token;
    expect(session.usuario.proyectos.map((project: Json) => project.id).sort()).toEqual([ids.norte, ids.sur].sort());
  });

  it("lists and opens only the admin's projects", async () => {
    const list = await call("GET", "/proyectos?limite=100", { token: tokens.admin });
    expect(list.status).toBe(200);
    expect(list.body.items.map((project: Json) => project.id).sort()).toEqual([ids.norte, ids.sur].sort());

    expect((await call("GET", `/proyectos/${ids.norte}`, { token: tokens.admin })).status).toBe(200);
    expect((await call("GET", `/proyectos/${ids.otro}`, { token: tokens.admin })).status).toBe(403);
    expect((await call("PATCH", `/proyectos/${ids.otro}`, { token: tokens.admin, body: { nombre: "x" } })).status).toBe(403);

    const renamed = await call("PATCH", `/proyectos/${ids.norte}`, { token: tokens.admin, body: { descripcion: "Gradas" } });
    expect(renamed.body.descripcion).toBe("Gradas");

    expect((await call("POST", "/proyectos", { token: tokens.admin, body: { nombre: "Mío", clave: `${tag}-mio` } })).status).toBe(403);
    expect((await call("DELETE", `/proyectos/${ids.sur}`, { token: tokens.admin })).status).toBe(403);
  });

  it("lets an admin manage users only within its projects", async () => {
    const inSur = await call("POST", "/usuarios", {
      token: tokens.admin,
      body: { nombre: "Taquilla", apellido: tag, correo: correo("taquilla"), password: PASSWORD, permissionProfileId: ids.profile, proyectoIds: [ids.sur] },
    });
    expect(inSur.status).toBe(201);

    const outside = await call("POST", "/usuarios", {
      token: tokens.admin,
      body: { nombre: "Fuera", apellido: tag, correo: correo("fuera"), password: PASSWORD, permissionProfileId: ids.profile, proyectoIds: [ids.otro] },
    });
    expect(outside.status).toBe(403);

    const none = await call("POST", "/usuarios", {
      token: tokens.admin,
      body: { nombre: "Nadie", apellido: tag, correo: correo("nadie"), password: PASSWORD, permissionProfileId: ids.profile },
    });
    expect(none.status).toBe(400);

    // A user only in "otro" is invisible to the admin.
    const hidden = await db().user.create({
      data: {
        nombre: "Oculto",
        apellido: tag,
        correo: correo("oculto"),
        password: "x",
        permissionProfileId: ids.profile,
        projects: { create: [{ projectId: ids.otro }] },
      },
    });
    const visible = await call("GET", `/usuarios?buscar=${tag}&limite=100`, { token: tokens.admin });
    const names = visible.body.items.map((user: Json) => user.nombre);
    expect(names).toEqual(expect.arrayContaining(["Gerente", "Taquilla"]));
    expect(names).not.toContain("Oculto");
    expect((await call("GET", `/usuarios/${hidden.id}`, { token: tokens.admin })).status).toBe(404);
  });

  it("keeps the projects an admin cannot see when it changes a user's projects", async () => {
    const shared = await db().user.create({
      data: {
        nombre: "Compartido",
        apellido: tag,
        correo: correo("compartido"),
        password: "x",
        permissionProfileId: ids.profile,
        projects: { create: [{ projectId: ids.norte }, { projectId: ids.otro }] },
      },
    });
    const updated = await call("PATCH", `/usuarios/${shared.id}`, { token: tokens.admin, body: { proyectoIds: [ids.sur] } });
    expect(updated.status).toBe(200);
    expect([...updated.body.proyectoIds].sort()).toEqual([ids.otro, ids.sur].sort());
  });

  it("drops a deactivated project from an admin's session and access", async () => {
    await call("PATCH", `/proyectos/${ids.sur}`, { token: tokens.super, body: { estado: false } });
    const session = await call("GET", "/auth/renew", { token: tokens.admin });
    expect(session.body.usuario.proyectos.map((project: Json) => project.id)).toEqual([ids.norte]);
    expect((await call("GET", `/proyectos/${ids.sur}`, { token: tokens.admin })).status).toBe(403);
    expect((await call("GET", `/proyectos/${ids.sur}`, { token: tokens.super })).status).toBe(200);
  });

  it("deletes a project and its user assignments", async () => {
    expect((await call("DELETE", `/proyectos/${ids.otro}`, { token: tokens.super })).status).toBe(200);
    expect(await db().userProject.count({ where: { projectId: ids.otro } })).toBe(0);
    expect((await call("GET", `/proyectos/${ids.otro}`, { token: tokens.super })).status).toBe(404);
  });
});
