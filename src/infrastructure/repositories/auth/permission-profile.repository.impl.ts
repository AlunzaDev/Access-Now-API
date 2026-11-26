import type {
  NewPermissionProfile,
  PermissionProfileChanges,
  PermissionProfileDatasource,
} from "../../../domain/datasources/auth/permission-profile.datasource";
import type { PermissionProfileEntity } from "../../../domain/entities/auth/permission-profile.entity";
import type { PermissionProfileRepository } from "../../../domain/repositories/auth/permission-profile.repository";

export class PermissionProfileRepositoryImpl implements PermissionProfileRepository {
  constructor(private readonly datasource: PermissionProfileDatasource) {}

  create(profile: NewPermissionProfile): Promise<PermissionProfileEntity> {
    return this.datasource.create(profile);
  }

  getAll(): Promise<PermissionProfileEntity[]> {
    return this.datasource.getAll();
  }

  findById(id: string): Promise<PermissionProfileEntity | null> {
    return this.datasource.findById(id);
  }

  findByNombre(nombre: string): Promise<PermissionProfileEntity | null> {
    return this.datasource.findByNombre(nombre);
  }

  update(id: string, changes: PermissionProfileChanges): Promise<PermissionProfileEntity | null> {
    return this.datasource.update(id, changes);
  }

  delete(id: string): Promise<PermissionProfileEntity | null> {
    return this.datasource.delete(id);
  }
}
