import type { DeviceCommandDatasource } from "../../../domain/datasources/device-command/device-command.datasource";
import type { DeviceCommandRepository } from "../../../domain/repository/device-command/device-command.repository";

export class DeviceCommandRepositoryImpl implements DeviceCommandRepository {
  constructor(private readonly datasource: DeviceCommandDatasource) {}

  enqueue: DeviceCommandRepository["enqueue"] = (...args) => this.datasource.enqueue(...args);
  findById: DeviceCommandRepository["findById"] = (...args) => this.datasource.findById(...args);
  list: DeviceCommandRepository["list"] = (...args) => this.datasource.list(...args);
  listOpen: DeviceCommandRepository["listOpen"] = (...args) => this.datasource.listOpen(...args);
  markDelivered: DeviceCommandRepository["markDelivered"] = (...args) => this.datasource.markDelivered(...args);
  finish: DeviceCommandRepository["finish"] = (...args) => this.datasource.finish(...args);
  cancel: DeviceCommandRepository["cancel"] = (...args) => this.datasource.cancel(...args);
}
