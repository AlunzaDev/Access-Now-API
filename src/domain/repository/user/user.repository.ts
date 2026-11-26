import type { UserDatasource } from "../../datasources/user/user.datasource";

/** Same operations as the datasource; services depend on this interface (docs/arquitectura.md). */
export type UserRepository = UserDatasource;
