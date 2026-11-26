import { Router } from "express";
import type { AuthMiddleware } from "../../../api/middlewares/auth.middleware";
import { AUTH_ROLES } from "../../../domain/constants";
import { buildPermissionProfileController } from "../../dependencies";

/** /api/perfiles-permisos: permission profiles (module `permissionProfiles`). */
export class PermissionProfileRoutes {
  static routes(auth: AuthMiddleware): Router {
    const router = Router();
    const controller = buildPermissionProfileController();

    router.use(auth.requireAuth, auth.requireModules("permissionProfiles"));

    router.get("/modulos", controller.modules);
    router.get("/", controller.list);
    router.post("/", controller.create);
    router.get("/:id", controller.getById);
    router.patch("/:id", controller.update);
    router.delete("/:id", auth.requireRoles(AUTH_ROLES.SUPER), controller.delete);

    return router;
  }
}
