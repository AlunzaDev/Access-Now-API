import { Router } from "express";
import { runWithAuditContext } from "../../config/audit-context";
import { ErrorService } from "../../api/middlewares/errors/error-handler";
import { buildAuthMiddleware, buildGatewayAuthMiddleware } from "../dependencies";
import { AuthRoutes } from "./auth/auth.routes";
import { HealthRoutes } from "./health/health.routes";
import { ProjectRoutes } from "./project/project.routes";
import { PermissionProfileRoutes } from "./permission-profile/permission-profile.routes";
import { UserRoutes } from "./user/user.routes";
import { DeviceRoutes } from "./device/device.routes";
import { EventRoutes } from "./event/event.routes";
import { TicketRoutes } from "./ticket/ticket.routes";

/** Every route under /api. Paths are API contract, in Spanish (docs/convencion-nombres.md). */
export class AppRoutes {
  static get routes(): Router {
    const router = Router();
    const auth = buildAuthMiddleware();

    router.use((_req, _res, next) => runWithAuditContext(next));

    router.get("/api/ping", (_req, res) => {
      res.json({ service: "access-now-api", status: "ok", message: "pong" });
    });
    router.use("/api/health", HealthRoutes.routes());
    router.use("/api/auth", AuthRoutes.routes(auth));
    router.use("/api/v1", DeviceRoutes.enrollment(buildGatewayAuthMiddleware()));
    router.use("/api/usuarios", UserRoutes.routes(auth));
    router.use("/api/perfiles-permisos", PermissionProfileRoutes.routes(auth));
    router.use("/api/proyectos/:proyectoId/dispositivos", DeviceRoutes.routes(auth));
    router.use("/api/proyectos/:proyectoId/eventos", EventRoutes.routes(auth));
    router.use("/api/proyectos/:proyectoId/boletos", TicketRoutes.routes(auth));
    router.use("/api/proyectos", ProjectRoutes.routes(auth));

    router.use("/api", ErrorService.notFound);
    return router;
  }
}
