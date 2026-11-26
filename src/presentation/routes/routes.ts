import { Router } from "express";
import { ErrorService } from "../../api/middlewares/error-handler";
import { buildAuthMiddleware } from "../dependencies";
import { AuthRoutes } from "./auth/auth.routes";
import { HealthRoutes } from "./health/health.routes";
import { PermissionProfileRoutes } from "./permission-profile/permission-profile.routes";
import { UserRoutes } from "./user/user.routes";

/** Every route under /api. Paths are API contract, in Spanish (docs/convencion-nombres.md). */
export class AppRoutes {
  static get routes(): Router {
    const router = Router();
    const auth = buildAuthMiddleware();

    router.get("/api/ping", (_req, res) => {
      res.json({ service: "access-now-api", status: "ok", message: "pong" });
    });
    router.use("/api/health", HealthRoutes.routes());
    router.use("/api/auth", AuthRoutes.routes(auth));
    router.use("/api/usuarios", UserRoutes.routes(auth));
    router.use("/api/perfiles-permisos", PermissionProfileRoutes.routes(auth));

    router.use("/api", ErrorService.notFound);
    return router;
  }
}
