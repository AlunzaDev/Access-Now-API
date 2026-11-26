import { Router } from "express";
import { AUTH_ROLES } from "../../../domain/constants";
import { buildUsuarioController } from "../../dependencies";
import { AuthMiddleware } from "../../middlewares";

export class UsuarioRoutes {
  static get routes(): Router {
    const router = Router();
    const controller = buildUsuarioController();

    router.use(AuthMiddleware.requireAuth, AuthMiddleware.requireModules("users"));

    router.post("/", AuthMiddleware.protectSuperUser, controller.create);
    router.get("/", controller.getAll);
    router.get("/:id", controller.getById);
    router.patch("/:id", AuthMiddleware.protectSuperUser, controller.update);
    router.delete("/:id", AuthMiddleware.requireRoles(AUTH_ROLES.SUPER), controller.delete);

    return router;
  }
}
