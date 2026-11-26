import type { PermissionProfileEntity } from "../../entities/auth/permission-profile.entity";

export type NewPermissionProfile = Omit<PermissionProfileEntity, "id">;
export type PermissionProfileChanges = Partial<NewPermissionProfile>;

export abstract class PermissionProfileDatasource {
  abstract create(profile: NewPermissionProfile): Promise<PermissionProfileEntity>;
  abstract getAll(): Promise<PermissionProfileEntity[]>;
  abstract findById(id: string): Promise<PermissionProfileEntity | null>;
  abstract findByNombre(nombre: string): Promise<PermissionProfileEntity | null>;
  abstract update(id: string, changes: PermissionProfileChanges): Promise<PermissionProfileEntity | null>;
  abstract delete(id: string): Promise<PermissionProfileEntity | null>;
}
