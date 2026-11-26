import type {
  NewProject,
  ProjectChanges,
  ProjectDatasource,
  ProjectListFilters,
} from "../../../domain/datasources/project/project.datasource";
import type { Page, PageRequest } from "../../../domain/dtos/shared/pagination";
import type { ProjectEntity } from "../../../domain/entities/project/project.entity";
import type { ProjectRepository } from "../../../domain/repository/project/project.repository";

/** Delegates to its datasource. A repository has no logic (docs/arquitectura.md). */
export class ProjectRepositoryImpl implements ProjectRepository {
  constructor(private readonly datasource: ProjectDatasource) {}

  create(project: NewProject): Promise<ProjectEntity> {
    return this.datasource.create(project);
  }

  list(filters: ProjectListFilters, page: PageRequest): Promise<Page<ProjectEntity>> {
    return this.datasource.list(filters, page);
  }

  findAll(): Promise<ProjectEntity[]> {
    return this.datasource.findAll();
  }

  findById(id: string): Promise<ProjectEntity | null> {
    return this.datasource.findById(id);
  }

  findByClave(clave: string): Promise<ProjectEntity | null> {
    return this.datasource.findByClave(clave);
  }

  findManyByIds(ids: string[]): Promise<ProjectEntity[]> {
    return this.datasource.findManyByIds(ids);
  }

  update(id: string, changes: ProjectChanges): Promise<ProjectEntity | null> {
    return this.datasource.update(id, changes);
  }

  delete(id: string): Promise<ProjectEntity | null> {
    return this.datasource.delete(id);
  }
}
