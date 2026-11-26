import type { NewUser, UserChanges, UserDatasource, UserListFilters } from "../../domain/datasources/user.datasource";
import type { Page, PageRequest } from "../../domain/dtos/shared/pagination";
import type { UserEntity } from "../../domain/entities/user.entity";
import type { UserRepository } from "../../domain/repository/user.repository";

/** Delegates to its datasource. A repository has no logic (docs/arquitectura.md). */
export class UserRepositoryImpl implements UserRepository {
  constructor(private readonly datasource: UserDatasource) {}

  create(user: NewUser): Promise<UserEntity> {
    return this.datasource.create(user);
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.datasource.findById(id);
  }

  findByEmail(correo: string): Promise<UserEntity | null> {
    return this.datasource.findByEmail(correo);
  }

  list(filters: UserListFilters, page: PageRequest): Promise<Page<UserEntity>> {
    return this.datasource.list(filters, page);
  }

  update(id: string, changes: UserChanges): Promise<UserEntity | null> {
    return this.datasource.update(id, changes);
  }

  delete(id: string): Promise<UserEntity | null> {
    return this.datasource.delete(id);
  }

  countByPermissionProfile(permissionProfileId: string): Promise<number> {
    return this.datasource.countByPermissionProfile(permissionProfileId);
  }

  savePasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    return this.datasource.savePasswordResetToken(userId, tokenHash, expiresAt);
  }

  findByPasswordResetToken(tokenHash: string): Promise<UserEntity | null> {
    return this.datasource.findByPasswordResetToken(tokenHash);
  }

  resetPassword(userId: string, passwordHash: string): Promise<void> {
    return this.datasource.resetPassword(userId, passwordHash);
  }
}
