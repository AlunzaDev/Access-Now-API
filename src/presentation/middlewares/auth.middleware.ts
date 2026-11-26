import type { NextFunction, Request, Response } from "express";
import { JwtPlugin } from "../../config/plugins/jwt.plugin";
import { AUTH_ROLES, type UserModuleAccess, type UsuarioRol } from "../../domain/constants";
import { CustomError } from "../../domain/errors/custom.error";
// Only repositories.dependencies here: controllers import this file, so importing the
// controller builders (auth.dependencies) would be a cycle.
import { buildPermissionProfileRepository, buildUsuarioRepository } from "../dependencies/repositories.dependencies";
import { SessionResolver, type SessionUsuario } from "../services/auth/session.resolver";

type AuthenticatedRequest = Request & { usuario?: SessionUsuario };

const usuarios = buildUsuarioRepository();
const sessions = new SessionResolver(buildPermissionProfileRepository());

/** The signed-in user; only set on routes behind `AuthMiddleware.requireAuth`. */
export const getRequestUser = (req: Request): SessionUsuario | undefined => (req as AuthenticatedRequest).usuario;

/** Id of the signed-in user, for controllers behind `requireAuth`. */
export const requestUserId = (req: Request): string => getRequestUser(req)?.id ?? "";

const readToken = (req: Request): string | undefined => {
  const authorization = req.header("Authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice("Bearer ".length).trim();
  return undefined;
};

export class AuthMiddleware {
  /** Requires a valid token of an active user; the user and its modules are read again on every request. */
  static requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authRequest = req as AuthenticatedRequest;
      if (authRequest.usuario) return next();

      const token = readToken(req);
      if (!token) return res.status(401).json({ error: "No token provided" });

      const payload = await JwtPlugin.validateToken(token);
      const userId = String((payload as { id?: unknown } | null)?.id ?? "").trim();
      if (!userId) return res.status(401).json({ error: "Invalid token" });

      const usuario = await usuarios.findById(userId);
      if (!usuario) return res.status(401).json({ error: "User not found" });

      authRequest.usuario = await sessions.resolve(usuario);
      return next();
    } catch (error) {
      const normalized = CustomError.fromUnknown(error, "No se pudo validar la sesión");
      return res.status(normalized.statusCode).json({ error: normalized.message, code: normalized.code });
    }
  };

  static requireRoles = (...allowedRoles: UsuarioRol[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const usuario = getRequestUser(req);
      if (!usuario) return res.status(401).json({ error: "Unauthorized" });
      if (!allowedRoles.includes(usuario.rol)) return res.status(403).json({ error: "Forbidden" });
      return next();
    };
  };

  /** Passes when the user may open any of the given sections (SUPER_ROLE opens all). */
  static requireModules = (...allowedModules: UserModuleAccess[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const usuario = getRequestUser(req);
      if (!usuario) return res.status(401).json({ error: "Unauthorized" });
      if (usuario.rol === AUTH_ROLES.SUPER) return next();
      if (!allowedModules.some((module) => usuario.modules.includes(module))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      return next();
    };
  };

  /** Only a super administrator may create, change or remove a super administrator. */
  static protectSuperUser = async (req: Request, res: Response, next: NextFunction) => {
    const actor = getRequestUser(req);
    if (!actor) return res.status(401).json({ error: "Unauthorized" });
    if (actor.rol === AUTH_ROLES.SUPER) return next();

    if (req.body?.rol === AUTH_ROLES.SUPER) {
      return res.status(403).json({ error: "Solo un super administrador puede asignar SUPER_ROLE" });
    }

    const targetId = String(req.params.id ?? "").trim();
    if (targetId) {
      const target = await usuarios.findById(targetId);
      if (target?.rol === AUTH_ROLES.SUPER) {
        return res.status(403).json({ error: "Solo un super administrador puede modificar esta cuenta" });
      }
    }
    return next();
  };
}
