import { Router } from "express";
import type { AuthMiddleware, GatewayAuthMiddleware } from "../../../api/middlewares";
import { buildDeviceController } from "../../dependencies";

export class DeviceRoutes {
  /** /api/v1: the SCAT-compatible gateway API (enroll with the enrollment token; the rest with the operational one). */
  static enrollment(gateway: GatewayAuthMiddleware): Router {
    const router = Router();
    const controller = buildDeviceController();
    router.post("/device/enroll", controller.enroll);
    router.get("/me", gateway.requireGateway, controller.me);
    router.post("/device/heartbeat", gateway.requireGateway, controller.heartbeat);
    return router;
  }

  static routes(auth: AuthMiddleware): Router {
    const router = Router({ mergeParams: true });
    const controller = buildDeviceController();

    router.use(auth.requireAuth, auth.requireModules("scanners"), auth.requireProjectAccess());
    router.get("/", controller.list);
    router.post("/", controller.create);
    router.get("/:id", controller.getById);
    router.patch("/:id", controller.update);
    router.delete("/:id", controller.delete);
    router.post("/:id/token-enrolamiento", controller.createEnrollmentToken);
    router.get("/:id/estado", controller.status);
    router.get("/:id/historial", controller.history);

    return router;
  }
}
