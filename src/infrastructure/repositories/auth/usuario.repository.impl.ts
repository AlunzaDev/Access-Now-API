import type {
  NewUsuario,
  UsuarioChanges,
  UsuarioDatasource,
} from "../../../domain/datasources/auth/usuario.datasource";
import type { UsuarioEntity } from "../../../domain/entities/auth/usuario.entity";
import type { UsuarioRepository } from "../../../domain/repositories/auth/usuario.repository";

export class UsuarioRepositoryImpl implements UsuarioRepository {
  constructor(private readonly datasource: UsuarioDatasource) {}

  create(usuario: NewUsuario): Promise<UsuarioEntity> {
    return this.datasource.create(usuario);
  }

  findById(id: string): Promise<UsuarioEntity | null> {
    return this.datasource.findById(id);
  }

  findByCorreo(correo: string): Promise<UsuarioEntity | null> {
    return this.datasource.findByCorreo(correo);
  }

  getAll(): Promise<UsuarioEntity[]> {
    return this.datasource.getAll();
  }

  update(id: string, changes: UsuarioChanges): Promise<UsuarioEntity | null> {
    return this.datasource.update(id, changes);
  }

  delete(id: string): Promise<UsuarioEntity | null> {
    return this.datasource.delete(id);
  }

  countByPermissionProfile(permissionProfileId: string): Promise<number> {
    return this.datasource.countByPermissionProfile(permissionProfileId);
  }

  savePasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    return this.datasource.savePasswordResetToken(userId, tokenHash, expiresAt);
  }

  findByPasswordResetToken(tokenHash: string): Promise<UsuarioEntity | null> {
    return this.datasource.findByPasswordResetToken(tokenHash);
  }

  resetPassword(userId: string, passwordHash: string): Promise<void> {
    return this.datasource.resetPassword(userId, passwordHash);
  }
}
