import cors, { type CorsOptions } from "cors";
import express, { type Router } from "express";
import type { Server as HttpServer } from "node:http";
import { ErrorService } from "../api/middlewares/error-handler";
import { logger } from "../config/logger";
import { envs } from "../config/plugins/envs.plugin";
import { PostgresDatabase } from "../infrastructure/prisma/postgres.database";

interface ServerOptions {
  host?: string;
  port: number;
  publicPath?: string;
  routes: Router;
}

const isDevelopmentLoopbackOrigin = (origin: string): boolean => {
  if (envs.PROD) return false;
  try {
    const { protocol, hostname } = new URL(origin);
    return (
      (protocol === "http:" || protocol === "https:") &&
      (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]")
    );
  } catch {
    return false;
  }
};

export class Server {
  private readonly app = express();
  private readonly host: string;
  private readonly port: number;
  private readonly publicPath: string;
  private readonly routes: Router;
  private httpServer?: HttpServer;
  private shuttingDown = false;

  constructor({ host = "0.0.0.0", port, publicPath = "public", routes }: ServerOptions) {
    this.host = host;
    this.port = port;
    this.publicPath = publicPath;
    this.routes = routes;
  }

  async start(): Promise<void> {
    await PostgresDatabase.connect({ databaseUrl: envs.DATABASE_URL, poolMax: envs.DATABASE_POOL_MAX });

    const corsOptions: CorsOptions = {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (envs.CORS_ALLOWED_ORIGINS.length === 0) return callback(null, !envs.PROD);
        return callback(null, envs.CORS_ALLOWED_ORIGINS.includes(origin) || isDevelopmentLoopbackOrigin(origin));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With", "Idempotency-Key"],
    };

    this.app.disable("x-powered-by");
    this.app.set("trust proxy", envs.TRUST_PROXY);
    this.app.use(cors(corsOptions));
    this.app.use(express.json({ limit: "2mb" }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(this.publicPath));
    this.app.use(this.routes);

    this.app.use(ErrorService.middleware);

    this.httpServer = this.app.listen(this.port, this.host, () => {
      logger.info(`Access Now API en ${this.host}:${this.port}`);
    });

    process.once("SIGTERM", () => void this.shutdown("SIGTERM"));
    process.once("SIGINT", () => void this.shutdown("SIGINT"));
  }

  /** Stops accepting requests, lets in-flight ones finish, then closes the database pool. */
  private async shutdown(signal: string): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    logger.info(`${signal} recibido, cerrando`);

    const forceExit = setTimeout(() => {
      logger.error("El cierre tardó demasiado, se fuerza la salida");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    try {
      await new Promise<void>((resolve) => {
        if (!this.httpServer) return resolve();
        this.httpServer.close(() => resolve());
        this.httpServer.closeIdleConnections();
      });
      await PostgresDatabase.disconnect();
      process.exit(0);
    } catch (error) {
      logger.error("Error durante el cierre", error);
      process.exit(1);
    }
  }
}
