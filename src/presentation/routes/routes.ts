import { Router } from "express";

import { AuthRoutes } from "./auth/auth.routes";
import { PermissionProfileRoutes } from "./auth/permission-profile.routes";
import { UsuarioRoutes } from "./auth/usuario.routes";
import { HealthRoutes } from "./health/health.routes";

export class AppRoutes {
  static get routes(): Router {
    const router = Router();

    router.get("/api/ping", (_req, res) => {
      res.status(200).json({ service: "access-now-api", status: "ok", message: "pong" });
    });
    router.use("/api/health", HealthRoutes.routes);
    router.use("/api/auth", AuthRoutes.routes);
    router.use("/api/usuarios", UsuarioRoutes.routes);
    router.use("/api/permission-profiles", PermissionProfileRoutes.routes);

    return router;
  }
}
