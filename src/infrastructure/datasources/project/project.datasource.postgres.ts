import type {
  NewProject,
  ProjectChanges,
  ProjectDatasource,
  ProjectListFilters,
} from "../../../domain/datasources/project/project.datasource";
import { toPage, type Page, type PageRequest } from "../../../domain/dtos/shared/pagination";
import { ProjectEntity } from "../../../domain/entities/project/project.entity";
import type { Prisma, Project } from "../../../generated/prisma/client";
import { PostgresDatabase } from "../../prisma/postgres.database";
import { isUuid, withPrismaErrors } from "../../prisma/prisma-errors";

const toEntity = (row: Project) =>
  ProjectEntity.fromObject({
    id: row.id,
    nombre: row.nombre,
    clave: row.clave,
    descripcion: row.descripcion,
    direccion: row.direccion,
    ciudad: row.ciudad,
    img: row.img,
    latitud: row.latitud,
    longitud: row.longitud,
    estado: row.estado,
  });

const listWhere = ({ buscar, ids }: ProjectListFilters): Prisma.ProjectWhereInput => ({
  ...(ids ? { id: { in: ids.filter(isUuid) } } : {}),
  ...(buscar
    ? {
        OR: [
          { nombre: { contains: buscar, mode: "insensitive" } },
          { clave: { contains: buscar, mode: "insensitive" } },
          { ciudad: { contains: buscar, mode: "insensitive" } },
        ],
      }
    : {}),
});

export class ProjectPostgresDatasource implements ProjectDatasource {
  private get projects() {
    return PostgresDatabase.client.project;
  }

  async create(project: NewProject): Promise<ProjectEntity> {
    const row = await withPrismaErrors(() =>
      this.projects.create({
        data: {
          nombre: project.nombre,
          clave: project.clave,
          descripcion: project.descripcion,
          direccion: project.direccion,
          ciudad: project.ciudad,
          img: project.img,
          latitud: project.latitud,
          longitud: project.longitud,
          estado: project.estado,
        },
      }),
    );
    return toEntity(row);
  }

  async list(filters: ProjectListFilters, { desde, limite }: PageRequest): Promise<Page<ProjectEntity>> {
    const where = listWhere(filters);
    const [rows, total] = await Promise.all([
      this.projects.findMany({ where, orderBy: [{ nombre: "asc" }, { id: "asc" }], skip: desde, take: limite }),
      this.projects.count({ where }),
    ]);
    return toPage(rows.map(toEntity), total);
  }

  async findAll(): Promise<ProjectEntity[]> {
    const rows = await this.projects.findMany({ orderBy: [{ nombre: "asc" }, { id: "asc" }] });
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<ProjectEntity | null> {
    if (!isUuid(id)) return null;
    const row = await this.projects.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByClave(clave: string): Promise<ProjectEntity | null> {
    const row = await this.projects.findUnique({ where: { clave } });
    return row ? toEntity(row) : null;
  }

  async findManyByIds(ids: string[]): Promise<ProjectEntity[]> {
    const valid = ids.filter(isUuid);
    if (valid.length === 0) return [];
    const rows = await this.projects.findMany({ where: { id: { in: valid } }, orderBy: [{ nombre: "asc" }] });
    return rows.map(toEntity);
  }

  async update(id: string, changes: ProjectChanges): Promise<ProjectEntity | null> {
    if (!(await this.findById(id))) return null;
    const row = await withPrismaErrors(() => this.projects.update({ where: { id }, data: changes }));
    return toEntity(row);
  }

  async delete(id: string): Promise<ProjectEntity | null> {
    const project = await this.findById(id);
    if (!project) return null;
    await withPrismaErrors(() => this.projects.delete({ where: { id } }));
    return project;
  }
}
