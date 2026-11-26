import type { NextFunction, Request, Response } from "express";
import type { SessionService, SessionUser } from "../../application/services/auth/session.service";
import { JwtPlugin } from "../../config/plugins/jwt.plugin";
import type { UserModuleAccess, UserRole } from "../../domain/constants";
import { canOpenModule } from "../../domain/policies/auth/session-policy";
import { ErrorService } from "./error-handler";

type AuthenticatedRequest = Request & { usuario?: SessionUser };

/** The signed-in user; only set on routes behind `requireAuth`. */
export const getSessionUser = (req: Request): SessionUser | undefined => (req as AuthenticatedRequest).usuario;

/** The signed-in user, for controllers behind `requireAuth` (it is always there). */
export const sessionUser = (req: Request): SessionUser => {
  const usuario = getSessionUser(req);
  if (!usuario) throw new Error("sessionUser() used on a route without requireAuth");
  return usuario;
};

const readBearerToken = (req: Request): string | undefined => {
  const authorization = req.header("Authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;
};

/** Builds the auth middlewares around a session service (wired in presentation/dependencies). */
export const createAuthMiddleware = (sessions: SessionService) => ({
  /** Valid token of an active user; the user and its modules are read again on every request. */
  requireAuth: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      if (authRequest.usuario) return next();

      const token = readBearerToken(req);
      if (!token) return ErrorService.send(res, 401, "Falta el token de sesión");

      const userId = String((await JwtPlugin.validateToken(token))?.id ?? "").trim();
      if (!userId) return ErrorService.send(res, 401, "La sesión no es válida o expiró");

      authRequest.usuario = await sessions.forUserId(userId);
      return next();
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  },

  requireRoles:
    (...allowedRoles: UserRole[]) =>
    (req: Request, res: Response, next: NextFunction) => {
      const usuario = getSessionUser(req);
      if (!usuario) return ErrorService.send(res, 401, "Falta el token de sesión");
      if (!allowedRoles.includes(usuario.rol)) return ErrorService.send(res, 403, "Tu rol no permite esta acción");
      return next();
    },

  /** Passes when the user may open any of the given sections (SUPER_ROLE opens all). */
  requireModules:
    (...modules: UserModuleAccess[]) =>
    (req: Request, res: Response, next: NextFunction) => {
      const usuario = getSessionUser(req);
      if (!usuario) return ErrorService.send(res, 401, "Falta el token de sesión");
      if (!modules.some((module) => canOpenModule(usuario, module))) {
        return ErrorService.send(res, 403, "No tienes acceso a esta sección");
      }
      return next();
    },
});

export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>;
