import { bcryptPlugin } from "../../../config/plugins/bcrypt.plugin";
import { AUTH_ROLES } from "../../../domain/constants";
import type { UsuarioChanges } from "../../../domain/datasources/auth/usuario.datasource";
import type { CreateUsuarioDto, UpdateUsuarioDto } from "../../../domain/dtos";
import { CustomError } from "../../../domain/errors/custom.error";
import type { PermissionProfileRepository } from "../../../domain/repositories/auth/permission-profile.repository";
import type { UsuarioRepository } from "../../../domain/repositories/auth/usuario.repository";
import { toSafeUsuario, type SafeUsuario } from "./session.resolver";

export class UsuarioService {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly profiles: PermissionProfileRepository,
  ) {}

  async create(dto: CreateUsuarioDto): Promise<SafeUsuario> {
    await this.ensureCorreoIsFree(dto.correo);
    const permissionProfileId = await this.profileFor(dto.rol, dto.permissionProfileId);

    const usuario = await this.usuarios.create({
      nombre: dto.nombre,
      apellido: dto.apellido,
      correo: dto.correo,
      telefono: dto.telefono,
      password: bcryptPlugin.hash(dto.password),
      rol: dto.rol,
      permissionProfileId: permissionProfileId ?? undefined,
      estado: dto.estado,
    });
    return toSafeUsuario(usuario);
  }

  async getAll(): Promise<SafeUsuario[]> {
    return (await this.usuarios.getAll()).map(toSafeUsuario);
  }

  async getById(id: string): Promise<SafeUsuario> {
    const usuario = await this.usuarios.findById(id);
    if (!usuario) throw CustomError.notFound("Usuario no encontrado");
    return toSafeUsuario(usuario);
  }

  async update(id: string, actorId: string, { values }: UpdateUsuarioDto): Promise<SafeUsuario> {
    const current = await this.usuarios.findById(id);
    if (!current) throw CustomError.notFound("Usuario no encontrado");

    if (id === actorId && (values.estado === false || (values.rol && values.rol !== current.rol))) {
      throw CustomError.badRequest("No puedes desactivarte ni cambiar tu propio rol");
    }
    if (values.correo && values.correo !== current.correo) await this.ensureCorreoIsFree(values.correo);

    const changes: UsuarioChanges = { ...values };
    if (values.password) changes.password = bcryptPlugin.hash(values.password);

    const rol = values.rol ?? current.rol;
    if (values.rol !== undefined || values.permissionProfileId !== undefined) {
      const requested =
        values.permissionProfileId === undefined ? current.permissionProfileId : values.permissionProfileId ?? undefined;
      changes.permissionProfileId = await this.profileFor(rol, requested);
    }

    const updated = await this.usuarios.update(id, changes);
    if (!updated) throw CustomError.notFound("Usuario no encontrado");
    return toSafeUsuario(updated);
  }

  async delete(id: string, actorId: string): Promise<SafeUsuario> {
    if (id === actorId) throw CustomError.badRequest("No puedes eliminar tu propia cuenta");
    const deleted = await this.usuarios.delete(id);
    if (!deleted) throw CustomError.notFound("Usuario no encontrado");
    return toSafeUsuario(deleted);
  }

  private async ensureCorreoIsFree(correo: string) {
    if (await this.usuarios.findByCorreo(correo)) {
      throw CustomError.badRequest("El correo ya está registrado");
    }
  }

  /** SUPER_ROLE opens everything and keeps no profile; ADMIN_ROLE needs an active one. */
  private async profileFor(rol: string, permissionProfileId: string | undefined): Promise<string | null> {
    if (rol === AUTH_ROLES.SUPER) return null;
    if (!permissionProfileId) {
      throw CustomError.badRequest("Un administrador necesita un perfil de permisos");
    }
    const profile = await this.profiles.findById(permissionProfileId);
    if (!profile || !profile.estado) {
      throw CustomError.badRequest("El perfil de permisos seleccionado no existe o está inactivo");
    }
    return profile.id;
  }
}
