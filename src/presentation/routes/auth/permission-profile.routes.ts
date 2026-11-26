import { Router } from "express";
import { AUTH_ROLES } from "../../../domain/constants";
import { buildPermissionProfileController } from "../../dependencies";
import { AuthMiddleware } from "../../middlewares";

export class PermissionProfileRoutes {
  static get routes(): Router {
    const router = Router();
    const controller = buildPermissionProfileController();

    router.use(AuthMiddleware.requireAuth, AuthMiddleware.requireModules("permissionProfiles"));

    router.get("/modules", controller.modules);
    router.post("/", controller.create);
    router.get("/", controller.getAll);
    router.get("/:id", controller.getById);
    router.patch("/:id", controller.update);
    router.delete("/:id", AuthMiddleware.requireRoles(AUTH_ROLES.SUPER), controller.delete);

    return router;
  }
}
