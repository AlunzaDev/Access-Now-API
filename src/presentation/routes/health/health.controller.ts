import type { Request, Response } from "express";
import { PostgresDatabase } from "../../../infrastructure/prisma/postgres.database";

export class HealthController {
  summary = async (_req: Request, res: Response) => {
    const db = await PostgresDatabase.getHealthSnapshot();
    const ok = db.status === "ok";
    return res.status(ok ? 200 : 503).json({
      service: "access-now-api",
      status: ok ? "ok" : "degraded",
      serverTime: Date.now(),
      db,
    });
  };
}
