import { AUTH_ROLES, USER_MODULES, type UserModuleAccess } from "../../../domain/constants";
import type { UsuarioEntity } from "../../../domain/entities/auth/usuario.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import type { PermissionProfileRepository } from "../../../domain/repositories/auth/permission-profile.repository";

export type SafeUsuario = Omit<UsuarioEntity, "password">;

/** The user as the dashboard sees it: no password, plus the sections it may open. */
export type SessionUsuario = SafeUsuario & { modules: UserModuleAccess[] };

export const toSafeUsuario = (usuario: UsuarioEntity): SafeUsuario => {
  const { password: _password, ...safe } = usuario;
  return safe;
};

/**
 * Decides whether a user may use the dashboard and which sections it may open.
 * Used at login and on every authenticated request, so a deactivated user or profile
 * loses access right away (not when its token expires).
 */
export class SessionResolver {
  constructor(private readonly profiles: PermissionProfileRepository) {}

  async resolve(usuario: UsuarioEntity): Promise<SessionUsuario> {
    if (!usuario.estado) throw CustomError.forbidden("Usuario inactivo");

    if (usuario.rol === AUTH_ROLES.SUPER) {
      return { ...toSafeUsuario(usuario), modules: [...USER_MODULES] };
    }

    if (!usuario.permissionProfileId) {
      throw CustomError.forbidden("No tienes un perfil de permisos asignado");
    }
    const profile = await this.profiles.findById(usuario.permissionProfileId);
    if (!profile || !profile.estado) {
      throw CustomError.forbidden("El perfil de permisos asignado no existe o está inactivo");
    }
    return { ...toSafeUsuario(usuario), modules: [...profile.modules] };
  }
}
