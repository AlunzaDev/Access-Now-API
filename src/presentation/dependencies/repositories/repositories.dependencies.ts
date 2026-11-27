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
import { DeviceCommandPostgresDatasource } from
  "../../../infrastructure/datasources/device-command/device-command.datasource.postgres";
import { DeviceCommandRepositoryImpl } from
  "../../../infrastructure/repositories/device-command/device-command.repository.impl";
import { EventPostgresDatasource } from "../../../infrastructure/datasources/event/event.datasource.postgres";
import { EventRepositoryImpl } from "../../../infrastructure/repositories/event/event.repository.impl";
import { TicketPostgresDatasource } from "../../../infrastructure/datasources/ticket/ticket.datasource.postgres";
import { TicketRepositoryImpl } from "../../../infrastructure/repositories/ticket/ticket.repository.impl";

export const buildUserRepository = () => new UserRepositoryImpl(new UserPostgresDatasource());

export const buildPermissionProfileRepository = () =>
  new PermissionProfileRepositoryImpl(new PermissionProfilePostgresDatasource());

export const buildProjectRepository = () => new ProjectRepositoryImpl(new ProjectPostgresDatasource());

export const buildDeviceRepository = () => new DeviceRepositoryImpl(new DevicePostgresDatasource());

export const buildDeviceCommandRepository = () =>
  new DeviceCommandRepositoryImpl(new DeviceCommandPostgresDatasource());

export const buildEventRepository = () => new EventRepositoryImpl(new EventPostgresDatasource());
export const buildTicketRepository = () => new TicketRepositoryImpl(new TicketPostgresDatasource());
