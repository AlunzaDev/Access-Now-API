import express from "express";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorService } from "../../src/api/middlewares/errors/error-handler";
import { bcryptPlugin } from "../../src/config/plugins/bcrypt.plugin";
import { PostgresDatabase } from "../../src/infrastructure/prisma/postgres.database";
import { AppRoutes } from "../../src/presentation/routes/routes";

// Events of a project: CRUD, image, schedule rules, status filter and never losing tickets.
type Json = Record<string, any>;

const db = () => PostgresDatabase.client;
const tag = `evt-${randomUUID().slice(0, 8)}`;
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
  return { status: response.status, body: (await response.json()) as Json };
};

describe("eventos por proyecto", () => {
  const ids = { norte: "", sur: "" };
  let token = "";
  const events = (projectId = ids.norte) => `/proyectos/${projectId}/eventos`;
  const newEvent = (overrides: Json = {}) =>
    call("POST", events(), {
      token,
      body: {
        nombre: "Festival de invierno",
        descripcion: "Tres días",
        fechaInicio: "2026-12-01",
        fechaFin: "2026-12-03",
        horaInicio: "10:00",
        horaFin: "22:00",
        ...overrides,
      },
    });

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
    ids.norte = (await db().project.create({ data: { nombre: `${tag}-norte`, clave: `${tag}-N`.toUpperCase() } })).id;
    ids.sur = (await db().project.create({ data: { nombre: `${tag}-sur`, clave: `${tag}-S`.toUpperCase() } })).id;

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
    await db().project.deleteMany({ where: { id: { in: [ids.norte, ids.sur] } } });
    await db().user.deleteMany({ where: { apellido: tag } });
    await PostgresDatabase.disconnect();
  });

  it("creates, lists, updates and filters events inside a project", async () => {
    const created = await newEvent();
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      nombre: "Festival de invierno",
      fechaInicio: "2026-12-01",
      fechaFin: "2026-12-03",
      zonaHoraria: "America/Mexico_City",
      capacidad: null,
      creadoPor: { nombre: `Super ${tag}` },
    });
    const id = created.body.id as string;

    expect((await call("GET", `${events()}?buscar=invierno`, { token })).body).toMatchObject({ total: 1 });

    const updated = await call("PATCH", `${events()}/${id}`, { token, body: { horaInicio: "11:00", estado: false } });
    expect(updated.body).toMatchObject({ horaInicio: "11:00", estado: false });
    expect((await call("GET", `${events()}?estado=inactivo`, { token })).body.total).toBe(1);
    expect((await call("GET", `${events()}?estado=activo`, { token })).body.total).toBe(0);

    expect((await call("GET", `${events(ids.sur)}/${id}`, { token })).status).toBe(404);
  });

  it("validates schedule, capacity and time zone", async () => {
    const backwards = await newEvent({ fechaInicio: "2026-12-03", fechaFin: "2026-12-01" });
    expect(backwards).toMatchObject({ status: 400, body: { ok: false, statusCode: 400, details: null } });
    expect((await newEvent({ fechaFin: "2026-12-01", horaFin: "09:00" })).status).toBe(400);
    expect((await newEvent({ capacidad: 0 })).status).toBe(400);
    expect((await newEvent({ zonaHoraria: "Mars/Olympus" })).status).toBe(400);
    expect((await newEvent({ otro: 1 })).status).toBe(400);
  });

  it("uploads, replaces and deletes the event image", async () => {
    const id = (await newEvent({ nombre: "Con foto" })).body.id as string;
    const form = new FormData();
    form.set("imagen", new Blob(["event"], { type: "image/png" }), "event.png");
    const image = await fetch(`${base}/api${events()}/${id}/imagen`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    expect(image.status).toBe(200);
    expect(((await image.json()) as Json).img).toMatch(new RegExp(`/uploads/eventos/${id}/[0-9a-f-]+\\.png$`));
    expect((await call("DELETE", `${events()}/${id}/imagen`, { token })).body.img).toBe("");
  });

  it("deletes an event without tickets but never one with tickets", async () => {
    const empty = (await newEvent({ nombre: "Sin boletos" })).body.id as string;
    expect((await call("DELETE", `${events()}/${empty}`, { token })).status).toBe(200);

    const withTickets = (await newEvent({ nombre: "Con boletos" })).body.id as string;
    await call("POST", `/proyectos/${ids.norte}/boletos`, { token, body: { eventoId: withTickets } });
    const refused = await call("DELETE", `${events()}/${withTickets}`, { token });
    expect(refused.status).toBe(409);
    expect(refused.body.message).toContain("desactívalo");
    expect(await db().ticket.count({ where: { eventId: withTickets } })).toBe(1);
  });
});
