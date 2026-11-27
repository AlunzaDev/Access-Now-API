import type { Page, PageRequest } from "../../dtos/shared/pagination";
import type { ProjectEntity } from "../../entities/project/project.entity";

export type NewProject = Omit<ProjectEntity, "id" | "creadoPor" | "creadoEn" | "actualizadoPor" | "actualizadoEn">;
export type ProjectChanges = Partial<NewProject>;

/** `ids` limits the list to those projects (an admin's); undefined lists all (super admin). */
export type ProjectListFilters = { buscar?: string; ids?: string[]; estado?: boolean };

export interface ProjectDatasource {
  create(project: NewProject): Promise<ProjectEntity>;
  list(filters: ProjectListFilters, page: PageRequest): Promise<Page<ProjectEntity>>;
  /** Every project, without paging (for a super admin's session). */
  findAll(): Promise<ProjectEntity[]>;
  findById(id: string): Promise<ProjectEntity | null>;
  findByClave(clave: string): Promise<ProjectEntity | null>;
  findManyByIds(ids: string[]): Promise<ProjectEntity[]>;
  update(id: string, changes: ProjectChanges): Promise<ProjectEntity | null>;
  delete(id: string): Promise<ProjectEntity | null>;
}
