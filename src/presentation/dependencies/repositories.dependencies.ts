// Repository builders shared by controllers, services and middlewares: the single place
// that decides which database implementation the API uses.
// Only infrastructure imports here, so any module can use them without import cycles.
import { PermissionProfilePostgresDatasource } from "../../infrastructure/datasources/auth/permission-profile.datasource.postgres";
import { UsuarioPostgresDatasource } from "../../infrastructure/datasources/auth/usuario.datasource.postgres";
import { PermissionProfileRepositoryImpl } from "../../infrastructure/repositories/auth/permission-profile.repository.impl";
import { UsuarioRepositoryImpl } from "../../infrastructure/repositories/auth/usuario.repository.impl";

export const buildUsuarioRepository = () => new UsuarioRepositoryImpl(new UsuarioPostgresDatasource());

export const buildPermissionProfileRepository = () =>
  new PermissionProfileRepositoryImpl(new PermissionProfilePostgresDatasource());
