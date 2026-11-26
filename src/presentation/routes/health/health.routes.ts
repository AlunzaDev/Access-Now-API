import { Router } from "express";
import { buildHealthController } from "../../dependencies";

export class HealthRoutes {
  static get routes(): Router {
    const router = Router();
    const controller = buildHealthController();

    router.get("/", controller.summary);

    return router;
  }
}
