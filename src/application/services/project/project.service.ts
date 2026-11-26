import type { CreateProjectDto, Page, PageRequest, UpdateProjectDto } from "../../../domain/dtos";
import type { ProjectEntity } from "../../../domain/entities/project/project.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import { canAccessProject, type ProjectAccess } from "../../../domain/policies/project/project-access-policy";
import type { ProjectRepository } from "../../../domain/repository/project/project.repository";

export class ProjectService {
  constructor(private readonly projects: ProjectRepository) {}

  async create(dto: CreateProjectDto): Promise<ProjectEntity> {
    await this.ensureClaveIsFree(dto.clave);
    return this.projects.create({
      nombre: dto.nombre,
      clave: dto.clave,
      descripcion: dto.descripcion,
      direccion: dto.direccion,
      ciudad: dto.ciudad,
      img: "",
      estado: dto.estado,
    });
  }

  /** A super admin lists every project; an admin only its own (active) ones. */
  list(access: ProjectAccess, filters: { buscar?: string }, page: PageRequest): Promise<Page<ProjectEntity>> {
    return this.projects.list({ ...filters, ids: access.all ? undefined : access.allowed }, page);
  }

  async getById(access: ProjectAccess, id: string): Promise<ProjectEntity> {
    return this.findAccessible(access, id);
  }

  async update(access: ProjectAccess, id: string, { values }: UpdateProjectDto): Promise<ProjectEntity> {
    await this.findAccessible(access, id);
    if (values.clave) await this.ensureClaveIsFree(values.clave, id);
    const updated = await this.projects.update(id, values);
    if (!updated) throw CustomError.notFound("Proyecto no encontrado");
    return updated;
  }

  async delete(id: string): Promise<ProjectEntity> {
    const deleted = await this.projects.delete(id);
    if (!deleted) throw CustomError.notFound("Proyecto no encontrado");
    return deleted;
  }

  /** A project the actor cannot see answers 404, the same as one that does not exist. */
  private async findAccessible(access: ProjectAccess, id: string): Promise<ProjectEntity> {
    const project = canAccessProject(access, id) ? await this.projects.findById(id) : null;
    if (!project) throw CustomError.notFound("Proyecto no encontrado");
    return project;
  }

  private async ensureClaveIsFree(clave: string, id?: string) {
    const existing = await this.projects.findByClave(clave);
    if (existing && existing.id !== id) throw CustomError.conflict("Ya existe un proyecto con esa clave");
  }
}
