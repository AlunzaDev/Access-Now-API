import type { NewUsuario, UsuarioChanges } from "../../datasources/auth/usuario.datasource";
import type { UsuarioEntity } from "../../entities/auth/usuario.entity";

export abstract class UsuarioRepository {
  abstract create(usuario: NewUsuario): Promise<UsuarioEntity>;
  abstract findById(id: string): Promise<UsuarioEntity | null>;
  abstract findByCorreo(correo: string): Promise<UsuarioEntity | null>;
  abstract getAll(): Promise<UsuarioEntity[]>;
  abstract update(id: string, changes: UsuarioChanges): Promise<UsuarioEntity | null>;
  abstract delete(id: string): Promise<UsuarioEntity | null>;
  abstract countByPermissionProfile(permissionProfileId: string): Promise<number>;

  abstract savePasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  abstract findByPasswordResetToken(tokenHash: string): Promise<UsuarioEntity | null>;
  abstract resetPassword(userId: string, passwordHash: string): Promise<void>;
}
