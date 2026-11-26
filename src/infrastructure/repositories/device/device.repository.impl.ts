import type { DeviceDatasource } from "../../../domain/datasources/device/device.datasource";
import type { DeviceRepository } from "../../../domain/repository/device/device.repository";

export class DeviceRepositoryImpl implements DeviceRepository {
  constructor(private readonly datasource: DeviceDatasource) {}

  create: DeviceRepository["create"] = (...args) => this.datasource.create(...args);
  list: DeviceRepository["list"] = (...args) => this.datasource.list(...args);
  findById: DeviceRepository["findById"] = (...args) => this.datasource.findById(...args);
  findByMac: DeviceRepository["findByMac"] = (...args) => this.datasource.findByMac(...args);
  findByEnrollmentTokenHash: DeviceRepository["findByEnrollmentTokenHash"] = (...args) =>
    this.datasource.findByEnrollmentTokenHash(...args);
  findEnrollmentData: DeviceRepository["findEnrollmentData"] = (...args) =>
    this.datasource.findEnrollmentData(...args);
  update: DeviceRepository["update"] = (...args) => this.datasource.update(...args);
  updateEnrollmentToken: DeviceRepository["updateEnrollmentToken"] = (...args) =>
    this.datasource.updateEnrollmentToken(...args);
  countTerminals: DeviceRepository["countTerminals"] = (...args) => this.datasource.countTerminals(...args);
  completeEnrollment: DeviceRepository["completeEnrollment"] = (...args) =>
    this.datasource.completeEnrollment(...args);
  delete: DeviceRepository["delete"] = (...args) => this.datasource.delete(...args);
}
