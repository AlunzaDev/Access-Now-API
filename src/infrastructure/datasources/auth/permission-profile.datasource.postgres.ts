import { PostgresDatabase } from "../../../data/postgres";
import type { PermissionProfile } from "../../../generated/prisma/client";
import {
  PermissionProfileDatasource,
  type NewPermissionProfile,
  type PermissionProfileChanges,
} from "../../../domain/datasources/auth/permission-profile.datasource";
import { PermissionProfileEntity } from "../../../domain/entities/auth/permission-profile.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import { isUuid, withPrismaErrors } from "../postgres/prisma-errors";

const toEntity = (row: PermissionProfile) =>
  PermissionProfileEntity.fromObject({
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    modules: row.modules,
    estado: row.estado,
  });

const profileInUse = CustomError.conflict("No se puede eliminar el perfil porque está asignado a usuarios");

export class PermissionProfilePostgresDatasource extends PermissionProfileDatasource {
  private get profiles() {
    return PostgresDatabase.client.permissionProfile;
  }

  async create(profile: NewPermissionProfile): Promise<PermissionProfileEntity> {
    const row = await withPrismaErrors(() =>
      this.profiles.create({
        data: {
          nombre: profile.nombre,
          descripcion: profile.descripcion ?? "",
          modules: profile.modules,
          estado: profile.estado,
        },
      }),
    );
    return toEntity(row);
  }

  async getAll(): Promise<PermissionProfileEntity[]> {
    const rows = await this.profiles.findMany({ orderBy: { nombre: "asc" } });
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<PermissionProfileEntity | null> {
    if (!isUuid(id)) return null;
    const row = await this.profiles.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByNombre(nombre: string): Promise<PermissionProfileEntity | null> {
    const row = await this.profiles.findUnique({ where: { nombre } });
    return row ? toEntity(row) : null;
  }

  async update(id: string, changes: PermissionProfileChanges): Promise<PermissionProfileEntity | null> {
    if (!(await this.findById(id))) return null;
    const row = await withPrismaErrors(() =>
      this.profiles.update({
        where: { id },
        data: {
          nombre: changes.nombre,
          descripcion: changes.descripcion,
          modules: changes.modules,
          estado: changes.estado,
        },
      }),
    );
    return toEntity(row);
  }

  async delete(id: string): Promise<PermissionProfileEntity | null> {
    const profile = await this.findById(id);
    if (!profile) return null;
    await withPrismaErrors(() => this.profiles.delete({ where: { id } }), { foreignKey: profileInUse });
    return profile;
  }
}
