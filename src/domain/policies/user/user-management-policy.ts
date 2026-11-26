import { AUTH_ROLES, type UserRole } from "../../constants";
import { CustomError } from "../../errors/custom.error";

type Actor = { id: string; rol: UserRole };
type Target = { id: string; rol: UserRole };

/** Only a super administrator may create, change or remove a super administrator. */
export const assertCanManageUser = (actor: Actor, target: Target | null, requestedRol?: UserRole): void => {
  if (actor.rol === AUTH_ROLES.SUPER) return;
  if (requestedRol === AUTH_ROLES.SUPER) {
    throw CustomError.forbidden("Solo un super administrador puede asignar SUPER_ROLE");
  }
  if (target?.rol === AUTH_ROLES.SUPER) {
    throw CustomError.forbidden("Solo un super administrador puede modificar esta cuenta");
  }
};

/** Nobody locks themselves out: no deactivating, demoting or deleting your own account. */
export const assertSelfChangeAllowed = (
  actorId: string,
  target: Target,
  changes: { estado?: boolean; rol?: UserRole; delete?: boolean },
): void => {
  if (actorId !== target.id) return;
  if (changes.delete) throw CustomError.badRequest("No puedes eliminar tu propia cuenta");
  if (changes.estado === false || (changes.rol !== undefined && changes.rol !== target.rol)) {
    throw CustomError.badRequest("No puedes desactivarte ni cambiar tu propio rol");
  }
};

/** ADMIN_ROLE needs a permission profile; SUPER_ROLE opens everything and keeps none. */
export const roleNeedsProfile = (rol: UserRole): boolean => rol === AUTH_ROLES.ADMIN;
