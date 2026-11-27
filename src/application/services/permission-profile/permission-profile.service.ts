import type {
  CreatePermissionProfileDto,
  Page,
  PageRequest,
  UpdatePermissionProfileDto,
} from "../../../domain/dtos";
import type { PermissionProfileEntity } from "../../../domain/entities/permission-profile/permission-profile.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import type { PermissionProfileRepository } from "../../../domain/repository/permission-profile/permission-profile.repository";
import type { UserRepository } from "../../../domain/repository/user/user.repository";

export class PermissionProfileService {
  constructor(
    private readonly profiles: PermissionProfileRepository,
    private readonly users: UserRepository,
  ) {}

  async create(dto: CreatePermissionProfileDto): Promise<PermissionProfileEntity> {
    await this.ensureNameIsFree(dto.nombre);
    return this.profiles.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      modules: dto.modules,
      estado: dto.estado,
    });
  }

  list(filters: { buscar?: string; estado?: boolean }, page: PageRequest): Promise<Page<PermissionProfileEntity>> {
    return this.profiles.list(filters, page);
  }

  async getById(id: string): Promise<PermissionProfileEntity> {
    const profile = await this.profiles.findById(id);
    if (!profile) throw CustomError.notFound("Perfil de permisos no encontrado");
    return profile;
  }

  async update(id: string, { values }: UpdatePermissionProfileDto): Promise<PermissionProfileEntity> {
    if (values.nombre) await this.ensureNameIsFree(values.nombre, id);
    const updated = await this.profiles.update(id, values);
    if (!updated) throw CustomError.notFound("Perfil de permisos no encontrado");
    return updated;
  }

  async delete(id: string): Promise<PermissionProfileEntity> {
    if ((await this.users.countByPermissionProfile(id)) > 0) {
      throw CustomError.conflict("No se puede eliminar el perfil porque hay usuarios asignados a él");
    }
    const deleted = await this.profiles.delete(id);
    if (!deleted) throw CustomError.notFound("Perfil de permisos no encontrado");
    return deleted;
  }

  private async ensureNameIsFree(nombre: string, id?: string) {
    const existing = await this.profiles.findByName(nombre);
    if (existing && existing.id !== id) throw CustomError.conflict("Ya existe un perfil con ese nombre");
  }
}
