import type { CreatePermissionProfileDto, UpdatePermissionProfileDto } from "../../../domain/dtos";
import type { PermissionProfileEntity } from "../../../domain/entities/auth/permission-profile.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import type { PermissionProfileRepository } from "../../../domain/repositories/auth/permission-profile.repository";
import type { UsuarioRepository } from "../../../domain/repositories/auth/usuario.repository";

export class PermissionProfileService {
  constructor(
    private readonly profiles: PermissionProfileRepository,
    private readonly usuarios: UsuarioRepository,
  ) {}

  async create(dto: CreatePermissionProfileDto): Promise<PermissionProfileEntity> {
    await this.ensureNombreIsFree(dto.nombre);
    return this.profiles.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      modules: dto.modules,
      estado: dto.estado,
    });
  }

  getAll(): Promise<PermissionProfileEntity[]> {
    return this.profiles.getAll();
  }

  async getById(id: string): Promise<PermissionProfileEntity> {
    const profile = await this.profiles.findById(id);
    if (!profile) throw CustomError.notFound("Perfil de permisos no encontrado");
    return profile;
  }

  async update(id: string, { values }: UpdatePermissionProfileDto): Promise<PermissionProfileEntity> {
    if (values.nombre) await this.ensureNombreIsFree(values.nombre, id);
    const updated = await this.profiles.update(id, values);
    if (!updated) throw CustomError.notFound("Perfil de permisos no encontrado");
    return updated;
  }

  async delete(id: string): Promise<PermissionProfileEntity> {
    if ((await this.usuarios.countByPermissionProfile(id)) > 0) {
      throw CustomError.conflict("No se puede eliminar el perfil porque hay usuarios asignados a él");
    }
    const deleted = await this.profiles.delete(id);
    if (!deleted) throw CustomError.notFound("Perfil de permisos no encontrado");
    return deleted;
  }

  private async ensureNombreIsFree(nombre: string, id?: string) {
    const existing = await this.profiles.findByNombre(nombre);
    if (existing && existing.id !== id) throw CustomError.badRequest("Ya existe un perfil con ese nombre");
  }
}
