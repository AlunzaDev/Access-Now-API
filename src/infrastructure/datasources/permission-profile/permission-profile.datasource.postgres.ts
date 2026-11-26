import type {
  NewPermissionProfile,
  PermissionProfileChanges,
  PermissionProfileDatasource,
} from "../../../domain/datasources/permission-profile/permission-profile.datasource";
import { toPage, type Page, type PageRequest } from "../../../domain/dtos/shared/pagination";
import { PermissionProfileEntity } from "../../../domain/entities/permission-profile/permission-profile.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import type { PermissionProfile, Prisma } from "../../../generated/prisma/client";
import { PostgresDatabase } from "../../prisma/postgres.database";
import { isUuid, withPrismaErrors } from "../../prisma/prisma-errors";

const toEntity = (row: PermissionProfile) =>
  PermissionProfileEntity.fromObject({
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    modules: row.modules,
    estado: row.estado,
  });

const profileInUse = CustomError.conflict("No se puede eliminar el perfil porque está asignado a usuarios");

export class PermissionProfilePostgresDatasource implements PermissionProfileDatasource {
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

  async list({ buscar }: { buscar?: string }, { desde, limite }: PageRequest): Promise<Page<PermissionProfileEntity>> {
    const where: Prisma.PermissionProfileWhereInput = buscar
      ? { nombre: { contains: buscar, mode: "insensitive" } }
      : {};
    const [rows, total] = await Promise.all([
      this.profiles.findMany({ where, orderBy: [{ nombre: "asc" }], skip: desde, take: limite }),
      this.profiles.count({ where }),
    ]);
    return toPage(rows.map(toEntity), total);
  }

  async findById(id: string): Promise<PermissionProfileEntity | null> {
    if (!isUuid(id)) return null;
    const row = await this.profiles.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByName(nombre: string): Promise<PermissionProfileEntity | null> {
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
