import type { Page, PageRequest } from "../../dtos/shared/pagination";
import type { UserEntity } from "../../entities/user/user.entity";

export type NewUser = Omit<UserEntity, "id">;

/** Fields to change; `permissionProfileId: null` removes the profile. */
export type UserChanges = Partial<Omit<UserEntity, "id" | "permissionProfileId">> & {
  permissionProfileId?: string | null;
};

/** `proyectoIds` lists only the users in any of those projects (an admin's); undefined lists all. */
export type UserListFilters = { buscar?: string; proyectoIds?: string[] };

export interface UserDatasource {
  create(user: NewUser): Promise<UserEntity>;
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(correo: string): Promise<UserEntity | null>;
  list(filters: UserListFilters, page: PageRequest): Promise<Page<UserEntity>>;
  update(id: string, changes: UserChanges): Promise<UserEntity | null>;
  delete(id: string): Promise<UserEntity | null>;
  countByPermissionProfile(permissionProfileId: string): Promise<number>;

  savePasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findByPasswordResetToken(tokenHash: string): Promise<UserEntity | null>;
  /** Sets the new password and consumes the reset token. */
  resetPassword(userId: string, passwordHash: string): Promise<void>;
}
