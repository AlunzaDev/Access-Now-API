import { AUTH_ROLES, type UserModuleAccess } from "../../../domain/constants";
import { toProjectSummary, type ProjectSummary } from "../../../domain/entities/project/project.entity";
import { toPublicUser, type PublicUser, type UserEntity } from "../../../domain/entities/user/user.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import { resolveSessionModules } from "../../../domain/policies/auth/session-policy";
import { sessionProjects } from "../../../domain/policies/project/project-access-policy";
import type { PermissionProfileRepository } from "../../../domain/repository/permission-profile/permission-profile.repository";
import type { ProjectRepository } from "../../../domain/repository/project/project.repository";
import type { UserRepository } from "../../../domain/repository/user/user.repository";

/** The user as the dashboard sees it: no password, plus the sections and projects it may open. */
export type SessionUser = PublicUser & { modules: UserModuleAccess[]; proyectos: ProjectSummary[] };

/** Loads a user, its profile and its projects, and applies the session policies. */
export class SessionService {
  constructor(
    private readonly users: UserRepository,
    private readonly profiles: PermissionProfileRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async forUser(user: UserEntity): Promise<SessionUser> {
    const profile = user.permissionProfileId ? await this.profiles.findById(user.permissionProfileId) : null;
    const modules = resolveSessionModules(user, profile);

    const isSuper = user.rol === AUTH_ROLES.SUPER;
    const [assigned, every] = await Promise.all([
      isSuper ? Promise.resolve([]) : this.projects.findManyByIds(user.proyectoIds),
      isSuper ? this.projects.findAll() : Promise.resolve([]),
    ]);
    const proyectos = sessionProjects(user.rol, assigned.map(toProjectSummary), every.map(toProjectSummary));

    return { ...toPublicUser(user), modules, proyectos };
  }

  async forUserId(userId: string): Promise<SessionUser> {
    const user = await this.users.findById(userId);
    if (!user) throw CustomError.unauthorized("Usuario no encontrado");
    return this.forUser(user);
  }
}
