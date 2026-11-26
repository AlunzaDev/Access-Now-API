import type { UsuarioEntity } from "../../entities/auth/usuario.entity";

export type NewUsuario = Omit<UsuarioEntity, "id">;

/** Fields to change; `permissionProfileId: null` removes the profile. */
export type UsuarioChanges = Partial<Omit<UsuarioEntity, "id" | "permissionProfileId">> & {
  permissionProfileId?: string | null;
};

export abstract class UsuarioDatasource {
  abstract create(usuario: NewUsuario): Promise<UsuarioEntity>;
  abstract findById(id: string): Promise<UsuarioEntity | null>;
  abstract findByCorreo(correo: string): Promise<UsuarioEntity | null>;
  abstract getAll(): Promise<UsuarioEntity[]>;
  abstract update(id: string, changes: UsuarioChanges): Promise<UsuarioEntity | null>;
  abstract delete(id: string): Promise<UsuarioEntity | null>;
  abstract countByPermissionProfile(permissionProfileId: string): Promise<number>;

  abstract savePasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  abstract findByPasswordResetToken(tokenHash: string): Promise<UsuarioEntity | null>;
  /** Sets the new password and consumes the reset token. */
  abstract resetPassword(userId: string, passwordHash: string): Promise<void>;
}
