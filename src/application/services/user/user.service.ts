import { bcryptPlugin } from "../../../config/plugins/bcrypt.plugin";
import type { UserRole } from "../../../domain/constants";
import type { UserChanges, UserListFilters } from "../../../domain/datasources/user/user.datasource";
import type { CreateUserDto, Page, PageRequest, UpdateUserDto } from "../../../domain/dtos";
import { toPublicUser, type PublicUser, type UserEntity } from "../../../domain/entities/user/user.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import {
  assertCanManageUser,
  assertSelfChangeAllowed,
  roleNeedsProfile,
} from "../../../domain/policies/user/user-management-policy";
import type { PermissionProfileRepository } from "../../../domain/repository/permission-profile/permission-profile.repository";
import type { UserRepository } from "../../../domain/repository/user/user.repository";

/** Who is making the request (from the session). */
export type Actor = { id: string; rol: UserRole };

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly profiles: PermissionProfileRepository,
  ) {}

  async create(actor: Actor, dto: CreateUserDto): Promise<PublicUser> {
    assertCanManageUser(actor, null, dto.rol);
    await this.ensureEmailIsFree(dto.correo);
    const permissionProfileId = await this.profileFor(dto.rol, dto.permissionProfileId);

    const user = await this.users.create({
      nombre: dto.nombre,
      apellido: dto.apellido,
      correo: dto.correo,
      telefono: dto.telefono,
      password: bcryptPlugin.hash(dto.password),
      rol: dto.rol,
      permissionProfileId: permissionProfileId ?? undefined,
      estado: dto.estado,
    });
    return toPublicUser(user);
  }

  async list(filters: UserListFilters, page: PageRequest): Promise<Page<PublicUser>> {
    const result = await this.users.list(filters, page);
    return { items: result.items.map(toPublicUser), total: result.total };
  }

  async getById(id: string): Promise<PublicUser> {
    return toPublicUser(await this.findOrFail(id));
  }

  async update(actor: Actor, id: string, { values }: UpdateUserDto): Promise<PublicUser> {
    const current = await this.findOrFail(id);
    assertCanManageUser(actor, current, values.rol);
    assertSelfChangeAllowed(actor.id, current, values);
    if (values.correo && values.correo !== current.correo) await this.ensureEmailIsFree(values.correo);

    const changes: UserChanges = { ...values };
    if (values.password) changes.password = bcryptPlugin.hash(values.password);

    if (values.rol !== undefined || values.permissionProfileId !== undefined) {
      const requested =
        values.permissionProfileId === undefined ? current.permissionProfileId : (values.permissionProfileId ?? undefined);
      changes.permissionProfileId = await this.profileFor(values.rol ?? current.rol, requested);
    }

    const updated = await this.users.update(id, changes);
    if (!updated) throw CustomError.notFound("Usuario no encontrado");
    return toPublicUser(updated);
  }

  async delete(actor: Actor, id: string): Promise<PublicUser> {
    const current = await this.findOrFail(id);
    assertCanManageUser(actor, current);
    assertSelfChangeAllowed(actor.id, current, { delete: true });
    const deleted = await this.users.delete(id);
    if (!deleted) throw CustomError.notFound("Usuario no encontrado");
    return toPublicUser(deleted);
  }

  private async findOrFail(id: string): Promise<UserEntity> {
    const user = await this.users.findById(id);
    if (!user) throw CustomError.notFound("Usuario no encontrado");
    return user;
  }

  private async ensureEmailIsFree(correo: string) {
    if (await this.users.findByEmail(correo)) throw CustomError.conflict("El correo ya está registrado");
  }

  /** The profile the user keeps: none for SUPER_ROLE, an active one for ADMIN_ROLE. */
  private async profileFor(rol: UserRole, permissionProfileId: string | undefined): Promise<string | null> {
    if (!roleNeedsProfile(rol)) return null;
    if (!permissionProfileId) throw CustomError.badRequest("Un administrador necesita un perfil de permisos");
    const profile = await this.profiles.findById(permissionProfileId);
    if (!profile || !profile.estado) {
      throw CustomError.badRequest("El perfil de permisos seleccionado no existe o está inactivo");
    }
    return profile.id;
  }
}
