import type { UserModuleAccess } from "../../../domain/constants";
import { toPublicUser, type PublicUser, type UserEntity } from "../../../domain/entities/user/user.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import { resolveSessionModules } from "../../../domain/policies/auth/session-policy";
import type { PermissionProfileRepository } from "../../../domain/repository/permission-profile/permission-profile.repository";
import type { UserRepository } from "../../../domain/repository/user/user.repository";

/** The user as the dashboard sees it: no password, plus the sections it may open. */
export type SessionUser = PublicUser & { modules: UserModuleAccess[] };

/** Loads a user and its profile and applies the session policy. */
export class SessionService {
  constructor(
    private readonly users: UserRepository,
    private readonly profiles: PermissionProfileRepository,
  ) {}

  async forUser(user: UserEntity): Promise<SessionUser> {
    const profile = user.permissionProfileId ? await this.profiles.findById(user.permissionProfileId) : null;
    return { ...toPublicUser(user), modules: resolveSessionModules(user, profile) };
  }

  async forUserId(userId: string): Promise<SessionUser> {
    const user = await this.users.findById(userId);
    if (!user) throw CustomError.unauthorized("Usuario no encontrado");
    return this.forUser(user);
  }
}
