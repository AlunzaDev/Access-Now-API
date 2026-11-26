import type {
  NewUser,
  UserChanges,
  UserDatasource,
  UserListFilters,
} from "../../../domain/datasources/user/user.datasource";
import { toPage, type Page, type PageRequest } from "../../../domain/dtos/shared/pagination";
import { UserEntity } from "../../../domain/entities/user/user.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import type { Prisma, User } from "../../../generated/prisma/client";
import { PostgresDatabase } from "../../prisma/postgres.database";
import { isUuid, withPrismaErrors } from "../../prisma/prisma-errors";

const toEntity = (row: User): UserEntity =>
  UserEntity.fromObject({
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido,
    correo: row.correo,
    telefono: row.telefono,
    password: row.password,
    rol: row.rol,
    permissionProfileId: row.permissionProfileId ?? undefined,
    img: row.img,
    estado: row.estado,
  });

const invalidProfile = CustomError.badRequest("El perfil de permisos asignado no existe");

const searchWhere = ({ buscar }: UserListFilters): Prisma.UserWhereInput =>
  buscar
    ? {
        OR: [
          { nombre: { contains: buscar, mode: "insensitive" } },
          { apellido: { contains: buscar, mode: "insensitive" } },
          { correo: { contains: buscar, mode: "insensitive" } },
        ],
      }
    : {};

export class UserPostgresDatasource implements UserDatasource {
  private get users() {
    return PostgresDatabase.client.user;
  }

  async create(user: NewUser): Promise<UserEntity> {
    const row = await withPrismaErrors(
      () =>
        this.users.create({
          data: {
            nombre: user.nombre,
            apellido: user.apellido,
            correo: user.correo.trim().toLowerCase(),
            telefono: user.telefono,
            password: user.password,
            rol: user.rol,
            permissionProfileId: user.permissionProfileId ?? null,
            img: user.img ?? "",
            estado: user.estado,
          },
        }),
      { foreignKey: invalidProfile },
    );
    return toEntity(row);
  }

  async findById(id: string): Promise<UserEntity | null> {
    if (!isUuid(id)) return null;
    const row = await this.users.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByEmail(correo: string): Promise<UserEntity | null> {
    const row = await this.users.findUnique({ where: { correo: correo.trim().toLowerCase() } });
    return row ? toEntity(row) : null;
  }

  async list(filters: UserListFilters, { desde, limite }: PageRequest): Promise<Page<UserEntity>> {
    const where = searchWhere(filters);
    const [rows, total] = await Promise.all([
      this.users.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: desde, take: limite }),
      this.users.count({ where }),
    ]);
    return toPage(rows.map(toEntity), total);
  }

  async update(id: string, changes: UserChanges): Promise<UserEntity | null> {
    if (!(await this.findById(id))) return null;
    const row = await withPrismaErrors(
      () =>
        this.users.update({
          where: { id },
          data: {
            nombre: changes.nombre,
            apellido: changes.apellido,
            correo: changes.correo?.trim().toLowerCase(),
            telefono: changes.telefono,
            password: changes.password,
            rol: changes.rol,
            permissionProfileId: changes.permissionProfileId,
            img: changes.img,
            estado: changes.estado,
          },
        }),
      { foreignKey: invalidProfile },
    );
    return toEntity(row);
  }

  async delete(id: string): Promise<UserEntity | null> {
    const user = await this.findById(id);
    if (!user) return null;
    await withPrismaErrors(() => this.users.delete({ where: { id } }));
    return user;
  }

  countByPermissionProfile(permissionProfileId: string): Promise<number> {
    if (!isUuid(permissionProfileId)) return Promise.resolve(0);
    return this.users.count({ where: { permissionProfileId } });
  }

  async savePasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.updateExisting(userId, { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt });
  }

  async findByPasswordResetToken(tokenHash: string): Promise<UserEntity | null> {
    const row = await this.users.findFirst({
      where: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { gt: new Date() } },
    });
    return row ? toEntity(row) : null;
  }

  async resetPassword(userId: string, passwordHash: string): Promise<void> {
    await this.updateExisting(userId, {
      password: passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    });
  }

  private async updateExisting(id: string, data: Prisma.UserUpdateManyMutationInput): Promise<void> {
    const { count } = isUuid(id) ? await this.users.updateMany({ where: { id }, data }) : { count: 0 };
    if (!count) throw CustomError.notFound("Usuario no encontrado");
  }
}
