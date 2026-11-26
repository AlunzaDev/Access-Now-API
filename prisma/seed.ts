// Development seed: `npm run db:seed`. Idempotent (upserts by natural keys), refuses to run in prod.
//
// Creates a permission profile with every module and the first super administrator.
// The password comes from SEED_ADMIN_PASSWORD, or is generated and printed once.
import { config as loadDotenv } from "dotenv";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { hashSync } from "bcryptjs";
import { PostgresDatabase } from "../src/infrastructure/prisma/postgres.database";
import { USER_MODULES } from "../src/domain/constants/auth/user-modules";

const appEnv = (process.env.APP_ENV ?? "dev").trim().toLowerCase();
if (appEnv === "prod") throw new Error("The seed must not run against production.");
const envFilePath = resolve(process.cwd(), `.env.${appEnv}`);
if (existsSync(envFilePath)) loadDotenv({ path: envFilePath, quiet: true });

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const db = await PostgresDatabase.connect({ databaseUrl });

  await db.permissionProfile.upsert({
    where: { nombre: "Administrador total" },
    create: { nombre: "Administrador total", descripcion: "Todos los módulos (seed)", modules: [...USER_MODULES] },
    update: {},
  });

  const correo = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || "admin@accessnow.local";
  const existing = await db.user.findUnique({ where: { correo } });
  if (existing) {
    console.log(`[SEED] ${correo} already exists; left unchanged.`);
    return;
  }

  const fromEnv = process.env.SEED_ADMIN_PASSWORD?.trim();
  const plainPassword = fromEnv || `${randomBytes(9).toString("base64url")}Aa1`;
  await db.user.create({
    data: {
      nombre: "Super",
      apellido: "Admin",
      correo,
      rol: "SUPER_ROLE",
      password: hashSync(plainPassword, 10),
    },
  });
  console.log(`[SEED] Super admin created: ${correo}`);
  if (!fromEnv) console.log(`[SEED] Generated password (shown only once): ${plainPassword}`);
};

main()
  .catch((error) => {
    console.error("[SEED] Failed", error);
    process.exitCode = 1;
  })
  .finally(() => PostgresDatabase.disconnect());
