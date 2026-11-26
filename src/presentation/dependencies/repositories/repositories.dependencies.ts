// Repository builders: the single place that decides which database implementation the API uses.
import { PermissionProfilePostgresDatasource } from
  "../../../infrastructure/datasources/permission-profile/permission-profile.datasource.postgres";
import { UserPostgresDatasource } from "../../../infrastructure/datasources/user/user.datasource.postgres";
import { PermissionProfileRepositoryImpl } from
  "../../../infrastructure/repositories/permission-profile/permission-profile.repository.impl";
import { UserRepositoryImpl } from "../../../infrastructure/repositories/user/user.repository.impl";
import { ProjectPostgresDatasource } from "../../../infrastructure/datasources/project/project.datasource.postgres";
import { ProjectRepositoryImpl } from "../../../infrastructure/repositories/project/project.repository.impl";
import { DevicePostgresDatasource } from "../../../infrastructure/datasources/device/device.datasource.postgres";
import { DeviceRepositoryImpl } from "../../../infrastructure/repositories/device/device.repository.impl";

export const buildUserRepository = () => new UserRepositoryImpl(new UserPostgresDatasource());

export const buildPermissionProfileRepository = () =>
  new PermissionProfileRepositoryImpl(new PermissionProfilePostgresDatasource());

export const buildProjectRepository = () => new ProjectRepositoryImpl(new ProjectPostgresDatasource());

export const buildDeviceRepository = () => new DeviceRepositoryImpl(new DevicePostgresDatasource());
