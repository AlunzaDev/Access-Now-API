import { AUTH_ROLES, type UserRole } from "../../constants";
import type { ProjectSummary } from "../../entities/project/project.entity";
import { CustomError } from "../../errors/custom.error";

/**
 * Which projects a user may see: every one (SUPER_ROLE) or the active ones assigned to it.
 * Services receive it instead of the request, so the rule lives in one place.
 */
export interface ProjectAccess {
  all: boolean;
  allowed: string[];
}

/**
 * The projects a session sees.
 * @param assigned the user's assigned projects (any state)
 * @param everyProject every project, only needed for SUPER_ROLE
 */
export const sessionProjects = (
  rol: UserRole,
  assigned: ProjectSummary[],
  everyProject: ProjectSummary[] = [],
): ProjectSummary[] => (rol === AUTH_ROLES.SUPER ? everyProject : assigned.filter((project) => project.estado));

export const projectAccessOf = (session: { rol: UserRole; proyectos: ProjectSummary[] }): ProjectAccess => ({
  all: session.rol === AUTH_ROLES.SUPER,
  allowed: session.proyectos.map((project) => project.id),
});

export const canAccessProject = (access: ProjectAccess, projectId: unknown): boolean => {
  if (access.all) return true;
  const id = String(projectId ?? "").trim();
  return Boolean(id) && access.allowed.includes(id);
};

/** An admin sees the users that share at least one of its projects. */
export const canSeeUser = (access: ProjectAccess, target: { proyectoIds: string[] }): boolean =>
  access.all || target.proyectoIds.some((id) => access.allowed.includes(id));

/**
 * The projects a user keeps after an admin changes them: the admin can only add or remove its
 * own projects; the ones it cannot see stay as they were.
 */
export const mergeProjectAssignment = (access: ProjectAccess, current: string[], requested: string[]): string[] => {
  if (access.all) return [...new Set(requested)];
  const outside = requested.filter((id) => !access.allowed.includes(id));
  if (outside.length > 0) {
    throw CustomError.forbidden("No puedes asignar proyectos a los que no tienes acceso", { proyectoIds: outside });
  }
  const untouched = current.filter((id) => !access.allowed.includes(id));
  return [...new Set([...untouched, ...requested])];
};
