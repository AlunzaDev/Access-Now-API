import type { NextFunction, Request, Response } from "express";
import { setAuditActor } from "../../../config/audit-context";
import type { GatewayService } from "../../../application/services/device/gateway.service";
import type { GatewayCredentials } from "../../../domain/datasources/device/device.datasource";
import { ErrorService } from "../errors/error-handler";

type GatewayRequest = Request & { gateway?: GatewayCredentials };

/** The authenticated gateway; only set on routes behind `requireGateway`. */
export const requestGateway = (req: Request): GatewayCredentials => {
  const gateway = (req as GatewayRequest).gateway;
  if (!gateway) throw new Error("requestGateway() used on a route without requireGateway");
  return gateway;
};

/** Builds the gateway (SCAT) authentication: `Authorization: Bearer <token operativo>`. */
export const createGatewayAuthMiddleware = (gateways: GatewayService) => ({
  requireGateway: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authorization = req.header("Authorization") ?? "";
      const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
      if (!token) return ErrorService.send(res, 401, "Invalid token");
      const gateway = await gateways.authenticate(token);
      (req as GatewayRequest).gateway = gateway;
      // What the gateway reports (results, detected terminals) is attributed to it, not to "Sistema".
      const name = gateway.device.nombre;
      setAuditActor({ id: gateway.device.id, nombre: /^gateway\b/i.test(name) ? name : `Gateway ${name}` });
      return next();
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  },
});

export type GatewayAuthMiddleware = ReturnType<typeof createGatewayAuthMiddleware>;
