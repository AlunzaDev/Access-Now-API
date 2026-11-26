import { AUTH_ROLES, USER_MODULES, type UserModuleAccess } from "../../constants";
import type { PermissionProfileEntity } from "../../entities/permission-profile.entity";
import type { UserEntity } from "../../entities/user.entity";
import { CustomError } from "../../errors/custom.error";

/**
 * Whether a user may use the dashboard and which sections it opens. Checked at login and on
 * every authenticated request, so deactivating a user or its profile cuts access right away.
 *
 * @param profile the user's permission profile (null when it has none or it was not found)
 */
export const resolveSessionModules = (
  user: UserEntity,
  profile: PermissionProfileEntity | null,
): UserModuleAccess[] => {
  if (!user.estado) throw CustomError.forbidden("Usuario inactivo");
  if (user.rol === AUTH_ROLES.SUPER) return [...USER_MODULES];

  if (!user.permissionProfileId) throw CustomError.forbidden("No tienes un perfil de permisos asignado");
  if (!profile || !profile.estado) {
    throw CustomError.forbidden("El perfil de permisos asignado no existe o está inactivo");
  }
  return [...profile.modules];
};

/** SUPER_ROLE opens every section; ADMIN_ROLE only the ones in its session. */
export const canOpenModule = (
  session: { rol: string; modules: readonly UserModuleAccess[] },
  module: UserModuleAccess,
): boolean => session.rol === AUTH_ROLES.SUPER || session.modules.includes(module);
