import { config as loadDotenv } from "dotenv";
import * as env from "env-var";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const appEnv = (process.env.APP_ENV ?? "dev").trim().toLowerCase();
const envFilePath = resolve(process.cwd(), `.env.${appEnv}`);

if (existsSync(envFilePath)) loadDotenv({ path: envFilePath, quiet: true });
else loadDotenv({ quiet: true });

const getConfigValue = (key: string): string | undefined => process.env[key];
const isProd = appEnv === "prod" || env.get("PROD").default("false").asBool();
const webServiceUrl = getConfigValue("WEB_SERVICE_URL") ?? "";
const webClientUrl = getConfigValue("WEB_CLIENT_URL")?.trim() || webServiceUrl;
const corsAllowedOrigins = [
  webClientUrl,
  webServiceUrl,
  ...(getConfigValue("CORS_ALLOWED_ORIGINS") ?? "").split(","),
]
  .map((value) => value.trim())
  .filter(Boolean);

const databaseUrl = getConfigValue("DATABASE_URL") ?? "";
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const parseBoundedInteger = (
  rawValue: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number => {
  if (!rawValue?.trim()) return fallback;
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid integer value "${rawValue}" for range ${min}-${max}`);
  }
  return parsed;
};

const jwtSeed = env.get("JWT_SEED").required().asString().trim();
const mailerEmail = env.get("MAILER_EMAIL").default("").asString().trim();
const mailerSecretKey = env.get("MAILER_SECRET_KEY").default("").asString().trim();
const mailerHost = env.get("MAILER_HOST").default("").asString().trim();

for (const origin of corsAllowedOrigins) {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error(`Invalid CORS origin: ${origin}`);
  }
  if (!(["http:", "https:"] as string[]).includes(parsed.protocol) || parsed.origin !== origin) {
    throw new Error(`CORS origin must be an exact HTTP(S) origin without a path: ${origin}`);
  }
}

if (isProd) {
  if (corsAllowedOrigins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS or WEB_CLIENT_URL is required in production.");
  }
  if (jwtSeed.length < 32) {
    throw new Error("JWT_SEED must contain at least 32 characters in production.");
  }
  if (!mailerEmail || !mailerSecretKey || !mailerHost) {
    throw new Error("MAILER_EMAIL, MAILER_SECRET_KEY and MAILER_HOST are required in production.");
  }
}

/**
 * Express "trust proxy": false (default, read the socket address), true, a hop count or a
 * list of trusted addresses. Set it when the API runs behind a reverse proxy so client
 * addresses come from X-Forwarded-For.
 */
const parseTrustProxy = (raw: string | undefined): boolean | number | string => {
  const value = String(raw ?? "").trim();
  if (!value || value === "false") return false;
  if (value === "true") return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
};

export const envs = {
  APP_ENV: appEnv,
  PROD: isProd,
  TRUST_PROXY: parseTrustProxy(env.get("TRUST_PROXY").asString()),
  // Login brute-force protection (failed attempts only).
  AUTH_LOGIN_WINDOW_MS: parseBoundedInteger(env.get("AUTH_LOGIN_WINDOW_MS").asString(), 15 * 60 * 1000, 60 * 1000, 24 * 60 * 60 * 1000),
  AUTH_LOGIN_MAX_FAILURES: parseBoundedInteger(env.get("AUTH_LOGIN_MAX_FAILURES").asString(), 5, 1, 1000),
  AUTH_LOGIN_IP_MAX_FAILURES: parseBoundedInteger(env.get("AUTH_LOGIN_IP_MAX_FAILURES").asString(), 20, 1, 10000),
  JWT_SEED: jwtSeed,
  DATABASE_URL: databaseUrl,
  DATABASE_POOL_MAX: parseBoundedInteger(env.get("DATABASE_POOL_MAX").asString(), 10, 1, 100),
  MAILER_EMAIL: mailerEmail,
  MAILER_SECRET_KEY: mailerSecretKey,
  MAILER_SERVICE: env.get("MAILER_SERVICE").default("").asString(),
  MAILER_HOST: mailerHost,
  MAILER_PORT: env.get("MAILER_PORT").default("465").asPortNumber(),
  MAILER_SECURE: env.get("MAILER_SECURE").default("true").asBool(),
  MAILER_FROM_NAME: env.get("MAILER_FROM_NAME").default("Access Now").asString(),
  HOST: env.get("HOST").default("0.0.0.0").asString(),
  PORT: env.get("PORT").default("8080").asPortNumber(),
  PUBLIC_PATH: env.get("PUBLIC_PATH").default("public").asString(),
  WEB_SERVICE_URL: webServiceUrl,
  WEB_CLIENT_URL: webClientUrl,
  CORS_ALLOWED_ORIGINS: [...new Set(corsAllowedOrigins)],
  SPACES_KEY: env.get("SPACES_KEY").default("").asString().trim(),
  SPACES_SECRET: env.get("SPACES_SECRET").default("").asString().trim(),
  SPACES_BUCKET: env.get("SPACES_BUCKET").default("").asString().trim(),
  SPACES_REGION: env.get("SPACES_REGION").default("").asString().trim(),
  SPACES_ENDPOINT: env.get("SPACES_ENDPOINT").default("").asString().trim(),
  SPACES_CDN_URL: env.get("SPACES_CDN_URL").default("").asString().trim(),
};
