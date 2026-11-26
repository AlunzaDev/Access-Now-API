import { bcryptPlugin } from "../../../config/plugins/bcrypt.plugin";
import { AUTH_ROLES, type UserRole } from "../../../domain/constants";
import type { UserChanges, UserListFilters } from "../../../domain/datasources/user/user.datasource";
import type { CreateUserDto, Page, PageRequest, UpdateUserDto } from "../../../domain/dtos";
import { toPublicUser, type PublicUser, type UserEntity } from "../../../domain/entities/user/user.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import { canSeeUser, mergeProjectAssignment } from "../../../domain/policies/project/project-access-policy";
import {
  assertCanManageUser,
  assertSelfChangeAllowed,
  roleNeedsProfile,
} from "../../../domain/policies/user/user-management-policy";
import type { PermissionProfileRepository } from "../../../domain/repository/permission-profile/permission-profile.repository";
import type { ProjectRepository } from "../../../domain/repository/project/project.repository";
import type { UserRepository } from "../../../domain/repository/user/user.repository";
import type { Actor } from "../shared/actor";

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly profiles: PermissionProfileRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async create(actor: Actor, dto: CreateUserDto): Promise<PublicUser> {
    assertCanManageUser(actor, null, dto.rol);
    await this.ensureEmailIsFree(dto.correo);
    const permissionProfileId = await this.profileFor(dto.rol, dto.permissionProfileId);
    const proyectoIds = await this.projectsFor(actor, dto.rol, [], dto.proyectoIds);

    const user = await this.users.create({
      nombre: dto.nombre,
      apellido: dto.apellido,
      correo: dto.correo,
      telefono: dto.telefono,
      password: bcryptPlugin.hash(dto.password),
      rol: dto.rol,
      permissionProfileId: permissionProfileId ?? undefined,
      proyectoIds,
      estado: dto.estado,
    });
    return toPublicUser(user);
  }

  /** A super admin lists everyone; an admin only the users that share one of its projects. */
  async list(actor: Actor, filters: UserListFilters, page: PageRequest): Promise<Page<PublicUser>> {
    const scope = actor.projectAccess.all ? {} : { proyectoIds: actor.projectAccess.allowed };
    const result = await this.users.list({ ...filters, ...scope }, page);
    return { items: result.items.map(toPublicUser), total: result.total };
  }

  async getById(actor: Actor, id: string): Promise<PublicUser> {
    return toPublicUser(await this.findVisible(actor, id));
  }

  async update(actor: Actor, id: string, { values }: UpdateUserDto): Promise<PublicUser> {
    const current = await this.findVisible(actor, id);
    assertCanManageUser(actor, current, values.rol);
    assertSelfChangeAllowed(actor.id, current, values);
    if (values.correo && values.correo !== current.correo) await this.ensureEmailIsFree(values.correo);

    const { proyectoIds: requestedProjects, ...rest } = values;
    const changes: UserChanges = { ...rest };
    if (values.password) changes.password = bcryptPlugin.hash(values.password);

    const rol = values.rol ?? current.rol;
    if (values.rol !== undefined || values.permissionProfileId !== undefined) {
      const requested =
        values.permissionProfileId === undefined ? current.permissionProfileId : (values.permissionProfileId ?? undefined);
      changes.permissionProfileId = await this.profileFor(rol, requested);
    }
    if (requestedProjects !== undefined || values.rol !== undefined) {
      changes.proyectoIds = await this.projectsFor(actor, rol, current.proyectoIds, requestedProjects ?? current.proyectoIds);
    }

    const updated = await this.users.update(id, changes);
    if (!updated) throw CustomError.notFound("Usuario no encontrado");
    return toPublicUser(updated);
  }

  async delete(actor: Actor, id: string): Promise<PublicUser> {
    const current = await this.findVisible(actor, id);
    assertCanManageUser(actor, current);
    assertSelfChangeAllowed(actor.id, current, { delete: true });
    const deleted = await this.users.delete(id);
    if (!deleted) throw CustomError.notFound("Usuario no encontrado");
    return toPublicUser(deleted);
  }

  /** A user outside the actor's projects answers 404, the same as one that does not exist. Yourself, always. */
  private async findVisible(actor: Actor, id: string): Promise<UserEntity> {
    const user = await this.users.findById(id);
    const visible = user && (user.id === actor.id || canSeeUser(actor.projectAccess, user));
    if (!user || !visible) throw CustomError.notFound("Usuario no encontrado");
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

  /** The projects the user keeps: none for SUPER_ROLE; for an admin, existing ones within the actor's reach. */
  private async projectsFor(actor: Actor, rol: UserRole, current: string[], requested: string[]): Promise<string[]> {
    if (rol === AUTH_ROLES.SUPER) return [];
    const merged = mergeProjectAssignment(actor.projectAccess, current, requested);
    const found = await this.projects.findManyByIds(merged);
    if (found.length !== merged.length) throw CustomError.badRequest("Uno o más proyectos asignados no existen");
    if (!actor.projectAccess.all && merged.length === 0) {
      throw CustomError.badRequest("Asigna al menos uno de tus proyectos");
    }
    return merged;
  }
}
