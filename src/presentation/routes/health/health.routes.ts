import { Router } from "express";
import { buildHealthController } from "../../dependencies";

export class HealthRoutes {
  static routes(): Router {
    const router = Router();
    router.get("/", buildHealthController().summary);
    return router;
  }
}
