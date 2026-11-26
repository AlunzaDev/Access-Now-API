import type {
  NewPermissionProfile,
  PermissionProfileChanges,
  PermissionProfileDatasource,
} from "../../../domain/datasources/permission-profile/permission-profile.datasource";
import type { Page, PageRequest } from "../../../domain/dtos/shared/pagination";
import type { PermissionProfileEntity } from "../../../domain/entities/permission-profile/permission-profile.entity";
import type { PermissionProfileRepository } from "../../../domain/repository/permission-profile/permission-profile.repository";

/** Delegates to its datasource. A repository has no logic (docs/arquitectura.md). */
export class PermissionProfileRepositoryImpl implements PermissionProfileRepository {
  constructor(private readonly datasource: PermissionProfileDatasource) {}

  create(profile: NewPermissionProfile): Promise<PermissionProfileEntity> {
    return this.datasource.create(profile);
  }

  list(filters: { buscar?: string }, page: PageRequest): Promise<Page<PermissionProfileEntity>> {
    return this.datasource.list(filters, page);
  }

  findById(id: string): Promise<PermissionProfileEntity | null> {
    return this.datasource.findById(id);
  }

  findByName(nombre: string): Promise<PermissionProfileEntity | null> {
    return this.datasource.findByName(nombre);
  }

  update(id: string, changes: PermissionProfileChanges): Promise<PermissionProfileEntity | null> {
    return this.datasource.update(id, changes);
  }

  delete(id: string): Promise<PermissionProfileEntity | null> {
    return this.datasource.delete(id);
  }
}
