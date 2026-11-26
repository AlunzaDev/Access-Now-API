import { PostgresDatabase } from "../../../data/postgres";
import type { Usuario } from "../../../generated/prisma/client";
import {
  UsuarioDatasource,
  type NewUsuario,
  type UsuarioChanges,
} from "../../../domain/datasources/auth/usuario.datasource";
import { UsuarioEntity } from "../../../domain/entities/auth/usuario.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import { isUuid, withPrismaErrors } from "../postgres/prisma-errors";

const toEntity = (row: Usuario): UsuarioEntity =>
  UsuarioEntity.fromObject({
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

export class UsuarioPostgresDatasource extends UsuarioDatasource {
  private get usuarios() {
    return PostgresDatabase.client.usuario;
  }

  async create(usuario: NewUsuario): Promise<UsuarioEntity> {
    const row = await withPrismaErrors(
      () =>
        this.usuarios.create({
          data: {
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            correo: usuario.correo.trim().toLowerCase(),
            telefono: usuario.telefono,
            password: usuario.password,
            rol: usuario.rol,
            permissionProfileId: usuario.permissionProfileId ?? null,
            img: usuario.img ?? "",
            estado: usuario.estado,
          },
        }),
      { foreignKey: invalidProfile },
    );
    return toEntity(row);
  }

  async findById(id: string): Promise<UsuarioEntity | null> {
    if (!isUuid(id)) return null;
    const row = await this.usuarios.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByCorreo(correo: string): Promise<UsuarioEntity | null> {
    const row = await this.usuarios.findUnique({ where: { correo: correo.trim().toLowerCase() } });
    return row ? toEntity(row) : null;
  }

  async getAll(): Promise<UsuarioEntity[]> {
    const rows = await this.usuarios.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return rows.map(toEntity);
  }

  async update(id: string, changes: UsuarioChanges): Promise<UsuarioEntity | null> {
    if (!isUuid(id)) return null;
    const exists = await this.usuarios.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return null;

    const row = await withPrismaErrors(
      () =>
        this.usuarios.update({
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

  async delete(id: string): Promise<UsuarioEntity | null> {
    const usuario = await this.findById(id);
    if (!usuario) return null;
    await withPrismaErrors(() => this.usuarios.delete({ where: { id } }));
    return usuario;
  }

  countByPermissionProfile(permissionProfileId: string): Promise<number> {
    if (!isUuid(permissionProfileId)) return Promise.resolve(0);
    return this.usuarios.count({ where: { permissionProfileId } });
  }

  async savePasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const { count } = isUuid(userId)
      ? await this.usuarios.updateMany({
          where: { id: userId },
          data: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt },
        })
      : { count: 0 };
    if (!count) throw CustomError.notFound("Usuario no encontrado");
  }

  async findByPasswordResetToken(tokenHash: string): Promise<UsuarioEntity | null> {
    const row = await this.usuarios.findFirst({
      where: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { gt: new Date() } },
    });
    return row ? toEntity(row) : null;
  }

  async resetPassword(userId: string, passwordHash: string): Promise<void> {
    const { count } = isUuid(userId)
      ? await this.usuarios.updateMany({
          where: { id: userId },
          data: { password: passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null },
        })
      : { count: 0 };
    if (!count) throw CustomError.notFound("Usuario no encontrado");
  }
}
