import { Router } from "express";
import type { AuthMiddleware } from "../../../api/middlewares";
import { buildDeviceController } from "../../dependencies";

export class DeviceRoutes {
  static enrollment(): Router {
    const router = Router();
    const controller = buildDeviceController();
    router.post("/device/enroll", controller.enroll);
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

    return router;
  }
}
