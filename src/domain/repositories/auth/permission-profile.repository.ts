import type {
  NewPermissionProfile,
  PermissionProfileChanges,
} from "../../datasources/auth/permission-profile.datasource";
import type { PermissionProfileEntity } from "../../entities/auth/permission-profile.entity";

export abstract class PermissionProfileRepository {
  abstract create(profile: NewPermissionProfile): Promise<PermissionProfileEntity>;
  abstract getAll(): Promise<PermissionProfileEntity[]>;
  abstract findById(id: string): Promise<PermissionProfileEntity | null>;
  abstract findByNombre(nombre: string): Promise<PermissionProfileEntity | null>;
  abstract update(id: string, changes: PermissionProfileChanges): Promise<PermissionProfileEntity | null>;
  abstract delete(id: string): Promise<PermissionProfileEntity | null>;
}
