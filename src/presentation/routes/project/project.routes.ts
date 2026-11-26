import { Router } from "express";
import type { AuthMiddleware } from "../../../api/middlewares/auth/auth.middleware";
import { AUTH_ROLES } from "../../../domain/constants";
import { buildProjectController } from "../../dependencies";

/**
 * /api/proyectos: projects (module `projects`). Creating and deleting is for SUPER_ROLE.
 * Everything under /:proyectoId checks that the user may see that project; events, tickets
 * and scanners will hang from /api/proyectos/:proyectoId/... with the same guard.
 */
export class ProjectRoutes {
  static routes(auth: AuthMiddleware): Router {
    const router = Router();
    const controller = buildProjectController();
    const superOnly = auth.requireRoles(AUTH_ROLES.SUPER);

    router.use(auth.requireAuth, auth.requireModules("projects"));

    router.get("/", controller.list);
    router.post("/", superOnly, controller.create);
    router.get("/:proyectoId", auth.requireProjectAccess(), controller.getById);
    router.patch("/:proyectoId", auth.requireProjectAccess(), controller.update);
    router.delete("/:proyectoId", superOnly, controller.delete);

    return router;
  }
}
