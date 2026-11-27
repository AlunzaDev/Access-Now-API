import { Router } from "express";
import { uploadEventImage, type AuthMiddleware } from "../../../api/middlewares";
import { buildEventController } from "../../dependencies";

export class EventRoutes {
  static routes(auth: AuthMiddleware): Router {
    const router = Router({ mergeParams: true });
    const controller = buildEventController();
    router.use(auth.requireAuth, auth.requireModules("events"), auth.requireProjectAccess());
    router.get("/", controller.list);
    router.post("/", controller.create);
    router.get("/:id", controller.getById);
    router.patch("/:id", controller.update);
    router.put("/:id/imagen", uploadEventImage, controller.uploadImage);
    router.delete("/:id/imagen", controller.deleteImage);
    router.delete("/:id", controller.delete);
    return router;
  }
}
