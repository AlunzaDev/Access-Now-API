import { createHash, randomUUID } from "node:crypto";
import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorService } from "../../src/api/middlewares/errors/error-handler";
import { bcryptPlugin } from "../../src/config/plugins/bcrypt.plugin";
import { PostgresDatabase } from "../../src/infrastructure/prisma/postgres.database";
import { AppRoutes } from "../../src/presentation/routes/routes";

type Json = Record<string, any>;

const db = () => PostgresDatabase.client;
const tag = `dev-${randomUUID().slice(0, 8)}`;
const password = "Secreta123";
const correo = (name: string) => `${name}-${tag}@example.test`;
let server: Server;
let baseUrl = "";

const call = async (
  method: string,
  path: string,
  { body, token }: { body?: unknown; token?: string } = {},
) => {
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

const expectApiError = (result: { status: number; body: Json }, statusCode: number) => {
  expect(result.status).toBe(statusCode);
  expect(result.body).toMatchObject({ ok: false, statusCode, details: null });
};

describe("dispositivos por proyecto", () => {
  const ids = {
    project: "",
    otherProject: "",
    profile: "",
    gateway: "",
    terminal: "",
    otherDevice: "",
    door: "",
  };
  const tokens = { super: "", admin: "" };

  beforeAll(async () => {
    await PostgresDatabase.connect({ databaseUrl: process.env.DATABASE_URL!, poolMax: 4 });
    await db().user.create({
      data: {
        nombre: "Super",
        apellido: tag,
        correo: correo("super"),
        rol: "SUPER_ROLE",
        password: bcryptPlugin.hash(password),
      },
    });
    ids.project = (await db().project.create({ data: { nombre: tag, clave: tag.toUpperCase() } })).id;
    ids.otherProject = (
      await db().project.create({ data: { nombre: `${tag}-other`, clave: `${tag}-OTHER`.toUpperCase() } })
    ).id;
    ids.door = (await db().venueDoor.create({
      data: { projectId: ids.project, nombre: "Puerta norte" },
    })).id;
    ids.profile = (
      await db().permissionProfile.create({ data: { nombre: tag, modules: ["scanners"] } })
    ).id;
    await db().user.create({
      data: {
        nombre: "Admin",
        apellido: tag,
        correo: correo("admin"),
        password: bcryptPlugin.hash(password),
        permissionProfileId: ids.profile,
        projects: { create: [{ projectId: ids.project }] },
      },
    });

    const app = express();
    app.use(express.json());
    app.use(AppRoutes.routes);
    app.use(ErrorService.middleware);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    tokens.super = (
      await call("POST", "/auth/login", { body: { correo: correo("super"), password } })
    ).body.token;
    tokens.admin = (
      await call("POST", "/auth/login", { body: { correo: correo("admin"), password } })
    ).body.token;
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await db().user.deleteMany({ where: { apellido: tag } });
    await db().project.deleteMany({ where: { id: { in: [ids.project, ids.otherProject] } } });
    await db().permissionProfile.deleteMany({ where: { id: ids.profile } });
    await PostgresDatabase.disconnect();
  });

  it("requires authentication, scanners module and project access", async () => {
    expectApiError(await call("GET", `/proyectos/${ids.project}/dispositivos`), 401);
    expectApiError(
      await call("GET", `/proyectos/${ids.otherProject}/dispositivos`, { token: tokens.admin }),
      403,
    );
  });

  it("exposes the venue to scanners but only projects may configure doors", async () => {
    const layout = await call("GET", `/proyectos/${ids.project}/recinto`, { token: tokens.admin });
    expect(layout.status).toBe(200);
    expect(layout.body.puertas).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: ids.door, nombre: "Puerta norte" }),
    ]));

    expectApiError(await call("POST", `/proyectos/${ids.project}/recinto/puertas`, {
      token: tokens.admin,
      body: { nombre: "Puerta restringida" },
    }), 403);

    const created = await call("POST", `/proyectos/${ids.project}/recinto/puertas`, {
      token: tokens.super,
      body: { nombre: "Puerta sur", descripcion: "Acceso sur", zonaIds: [] },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ nombre: "Puerta sur", zonaIds: [] });

    const withZone = await call("POST", `/proyectos/${ids.project}/recinto/zonas`, {
      token: tokens.super,
      body: { nombre: "General", descripcion: "Zona general" },
    });
    expect(withZone.status).toBe(201);
    const zone = withZone.body.zonas.find((item: Json) => item.nombre === "General");

    const withSection = await call("POST", `/proyectos/${ids.project}/recinto/zonas/${zone.id}/secciones`, {
      token: tokens.super,
      body: { nombre: "Norte" },
    });
    const section = withSection.body.zonas[0].secciones.find((item: Json) => item.nombre === "Norte");
    const withRow = await call("POST", `/proyectos/${ids.project}/recinto/secciones/${section.id}/filas`, {
      token: tokens.super,
      body: { nombre: "A" },
    });
    const row = withRow.body.zonas[0].secciones[0].filas.find((item: Json) => item.nombre === "A");
    const withSeat = await call("POST", `/proyectos/${ids.project}/recinto/filas/${row.id}/asientos`, {
      token: tokens.super,
      body: { nombre: "1" },
    });
    expect(withSeat.status).toBe(201);
    expect(withSeat.body.zonas[0].secciones[0].filas[0].asientos).toEqual(
      expect.arrayContaining([expect.objectContaining({ nombre: "1" })]),
    );

    const assigned = await call("PATCH", `/proyectos/${ids.project}/recinto/puertas/${created.body.id}`, {
      token: tokens.super,
      body: { zonaIds: [zone.id] },
    });
    expect(assigned.body.zonaIds).toEqual([zone.id]);
  });

  it("creates and normalizes a gateway", async () => {
    const result = await call("POST", `/proyectos/${ids.project}/dispositivos`, {
      token: tokens.admin,
      body: {
        tipo: "GATEWAY",
        nombre: "Gateway principal",
        ip: "192.168.1.10",
        mac: "aa-bb-cc-dd-ee-ff",
        modelo: "Raspberry Pi 5",
        urlRemota: "https://gateway.example.test",
      },
    });
    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({
      tipo: "GATEWAY",
      mac: "AA:BB:CC:DD:EE:FF",
      configEstado: "PENDIENTE",
      creadoPor: { nombre: `Admin ${tag}` },
      actualizadoPor: { nombre: `Admin ${tag}` },
    });
    expect(result.body.creadoEn).toEqual(expect.any(Number));
    expect(result.body.actualizadoEn).toEqual(expect.any(Number));
    expect(result.body).not.toHaveProperty("enrollmentTokenHash");
    ids.gateway = result.body.id;

    const duplicate = await call("POST", `/proyectos/${ids.project}/dispositivos`, {
      token: tokens.admin,
      body: { tipo: "GATEWAY", nombre: "Duplicado", ip: "192.168.1.11", mac: "aabbccddeeff" },
    });
    expectApiError(duplicate, 409);
  });

  it("validates IPv4 and fields exclusive to each type", async () => {
    expectApiError(
      await call("POST", `/proyectos/${ids.project}/dispositivos`, {
        token: tokens.admin,
        body: { tipo: "GATEWAY", nombre: "Mal", ip: "999.1.1.1" },
      }),
      400,
    );
    expectApiError(
      await call("POST", `/proyectos/${ids.project}/dispositivos`, {
        token: tokens.admin,
        body: { tipo: "GATEWAY", nombre: "Mal", ip: "10.0.0.1", puertaId: ids.door },
      }),
      400,
    );
  });

  it("requires a gateway from the same project for terminals", async () => {
    ids.otherDevice = (
      await db().device.create({
        data: { projectId: ids.otherProject, tipo: "GATEWAY", nombre: "Otro", ip: "10.0.0.1" },
      })
    ).id;
    const wrongGateway = await call("POST", `/proyectos/${ids.project}/dispositivos`, {
      token: tokens.admin,
      body: {
        tipo: "TERMINAL",
        nombre: "Terminal",
        ip: "192.168.1.20",
        mac: "11:22:33:44:55:66",
        gatewayId: ids.otherDevice,
        puertaId: ids.door,
        sentido: "ENTRADA",
      },
    });
    expectApiError(wrongGateway, 400);

    const result = await call("POST", `/proyectos/${ids.project}/dispositivos`, {
      token: tokens.admin,
      body: {
        tipo: "TERMINAL",
        nombre: "Terminal norte",
        ip: "192.168.1.20",
        mac: "11:22:33:44:55:66",
        gatewayId: ids.gateway,
        puertaId: ids.door,
        sentido: "ENTRADA",
      },
    });
    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({ gatewayId: ids.gateway, configEstado: "PENDIENTE" });
    ids.terminal = result.body.id;
  });

  it("lists with filters and keeps devices isolated by project", async () => {
    const list = await call(
      "GET",
      `/proyectos/${ids.project}/dispositivos?tipo=TERMINAL&gatewayId=${ids.gateway}&buscar=norte`,
      { token: tokens.admin },
    );
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ total: 1 });
    expect(list.body.items[0].id).toBe(ids.terminal);

    expectApiError(
      await call("GET", `/proyectos/${ids.project}/dispositivos/${ids.otherDevice}`, {
        token: tokens.admin,
      }),
      404,
    );
  });

  it("generates a one-time enrollment token only for gateways", async () => {
    const result = await call(
      "POST",
      `/proyectos/${ids.project}/dispositivos/${ids.gateway}/token-enrolamiento`,
      { token: tokens.admin },
    );
    expect(result.status).toBe(200);
    expect(result.body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.body.expiraEn).toBeGreaterThan(Date.now());

    const stored = await db().device.findUnique({ where: { id: ids.gateway } });
    expect(stored?.enrollmentTokenHash).toBe(
      createHash("sha256").update(result.body.token).digest("hex"),
    );
    expect(result.body).not.toHaveProperty("enrollmentTokenHash");
    const gateway = await call("GET", `/proyectos/${ids.project}/dispositivos/${ids.gateway}`, {
      token: tokens.admin,
    });
    expect(gateway.body).not.toHaveProperty("enrollmentTokenHash");
    expect(gateway.body).not.toHaveProperty("enrollmentTokenExpiresAt");

    const enrollment = await call("POST", "/v1/device/enroll", {
      body: {
        token: result.body.token,
        device_fingerprint: "scat-gateway-test",
        device_name: "Gateway norte",
      },
    });
    expect(enrollment.status).toBe(200);
    expect(enrollment.body).toMatchObject({
      token_type: "bearer",
      service: { type: "online", device: { id: ids.gateway } },
    });
    expect(enrollment.body.token).toMatch(/^[0-9a-f]{64}$/);
    const enrolled = await db().device.findUnique({ where: { id: ids.gateway } });
    expect(enrolled?.deviceTokenHash).toBe(
      createHash("sha256").update(enrollment.body.token).digest("hex"),
    );
    expect(enrolled?.enrollmentTokenHash).toBeNull();
    expectApiError(await call("POST", "/v1/device/enroll", {
      body: {
        token: result.body.token,
        device_fingerprint: "scat-gateway-test",
        device_name: "Gateway norte",
      },
    }), 400);

    expectApiError(
      await call(
        "POST",
        `/proyectos/${ids.project}/dispositivos/${ids.terminal}/token-enrolamiento`,
        { token: tokens.admin },
      ),
      400,
    );
  });

  it("updates a device and prevents deleting a gateway in use", async () => {
    const updated = await call("PATCH", `/proyectos/${ids.project}/dispositivos/${ids.terminal}`, {
      token: tokens.admin,
      body: { puertaId: ids.door, estado: false },
    });
    expect(updated.body).toMatchObject({ puertaId: ids.door, estado: false });

    expectApiError(
      await call("DELETE", `/proyectos/${ids.project}/dispositivos/${ids.gateway}`, {
        token: tokens.admin,
      }),
      409,
    );
    expect((await call("DELETE", `/proyectos/${ids.project}/dispositivos/${ids.terminal}`, {
      token: tokens.admin,
    })).status).toBe(200);
    expect((await call("DELETE", `/proyectos/${ids.project}/dispositivos/${ids.gateway}`, {
      token: tokens.admin,
    })).status).toBe(200);
  });
});
