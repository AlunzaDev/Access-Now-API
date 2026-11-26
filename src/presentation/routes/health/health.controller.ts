import type { Request, Response } from "express";
import { PostgresDatabase } from "../../../data/postgres";

export class HealthController {
  summary = async (_req: Request, res: Response) => {
    const db = await PostgresDatabase.getHealthSnapshot();
    const status = db.status === "ok" ? "ok" : "degraded";
    return res.status(status === "ok" ? 200 : 503).json({
      service: "access-now-api",
      status,
      serverTime: Date.now(),
      db,
    });
  };
}
