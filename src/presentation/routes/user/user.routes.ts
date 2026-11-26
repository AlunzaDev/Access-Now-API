import { Router } from "express";
import type { AuthMiddleware } from "../../../api/middlewares/auth.middleware";
import { AUTH_ROLES } from "../../../domain/constants";
import { buildUserController } from "../../dependencies";

/** /api/usuarios: dashboard users (module `users`). */
export class UserRoutes {
  static routes(auth: AuthMiddleware): Router {
    const router = Router();
    const controller = buildUserController();

    router.use(auth.requireAuth, auth.requireModules("users"));

    router.get("/", controller.list);
    router.post("/", controller.create);
    router.get("/:id", controller.getById);
    router.patch("/:id", controller.update);
    router.delete("/:id", auth.requireRoles(AUTH_ROLES.SUPER), controller.delete);

    return router;
  }
}
