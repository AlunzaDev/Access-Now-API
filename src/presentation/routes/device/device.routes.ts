import { Router } from "express";
import type { AuthMiddleware, GatewayAuthMiddleware } from "../../../api/middlewares";
import { failedAuthLimiter } from "../../../api/middlewares/rate-limit/rate-limit.middleware";
import { buildDeviceController, buildTicketCatalogController, buildTicketController } from "../../dependencies";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export class DeviceRoutes {
  /** /api/v1: the SCAT-compatible gateway API (enroll with the enrollment token; the rest with the operational one). */
  static enrollment(gateway: GatewayAuthMiddleware): Router {
    const router = Router();
    const controller = buildDeviceController();
    const tickets = buildTicketController();
    const catalog = buildTicketCatalogController();
    // Guessing is pointless (256-bit tokens), but failed attempts are capped per address so
    // nobody can hammer the gateway API. Valid calls never count.
    const enrollLimit = failedAuthLimiter({ windowMs: FIFTEEN_MINUTES, maxFailures: 10, failureStatuses: [400, 401, 403] });
    const tokenLimit = failedAuthLimiter({ windowMs: FIFTEEN_MINUTES, maxFailures: 20 });
    router.post("/device/enroll", enrollLimit, controller.enroll);
    router.get("/me", tokenLimit, gateway.requireGateway, controller.me);
    router.post("/device/heartbeat", tokenLimit, gateway.requireGateway, controller.heartbeat);
    router.post("/tickets/validate", tokenLimit, gateway.requireGateway, tickets.validateAccess);
    router.get("/tickets/catalogo", tokenLimit, gateway.requireGateway, catalog.catalog);
    router.post("/tickets/escaneos-offline", tokenLimit, gateway.requireGateway, catalog.offlineScans);
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
    router.post("/:id/revocar-enrolamiento", controller.revokeEnrollment);
    router.get("/:id/estado", controller.status);
    router.get("/:id/historial", auth.requireModules("history"), controller.history);
    router.get("/:id/comandos", controller.commands);
    router.post("/:id/sincronizar", controller.sync);
    router.post("/:id/comandos/:comandoId/cancelar", controller.cancelCommand);

    return router;
  }
}
