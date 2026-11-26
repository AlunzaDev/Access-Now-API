import type { Page, PageRequest } from "../../dtos/shared/pagination";
import type { PermissionProfileEntity } from "../../entities/permission-profile/permission-profile.entity";

export type NewPermissionProfile = Omit<PermissionProfileEntity, "id">;
export type PermissionProfileChanges = Partial<NewPermissionProfile>;

export interface PermissionProfileDatasource {
  create(profile: NewPermissionProfile): Promise<PermissionProfileEntity>;
  list(filters: { buscar?: string }, page: PageRequest): Promise<Page<PermissionProfileEntity>>;
  findById(id: string): Promise<PermissionProfileEntity | null>;
  findByName(nombre: string): Promise<PermissionProfileEntity | null>;
  update(id: string, changes: PermissionProfileChanges): Promise<PermissionProfileEntity | null>;
  delete(id: string): Promise<PermissionProfileEntity | null>;
}
