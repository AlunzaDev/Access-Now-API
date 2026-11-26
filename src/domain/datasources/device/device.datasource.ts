import type { DeviceValues } from "../../dtos/device/device-fields";
import type { Page, PageRequest } from "../../dtos/shared/pagination";
import type { DeviceEntity, DeviceType } from "../../entities/device/device.entity";

export type NewDevice = DeviceValues & {
  projectId: string;
  tipo: DeviceType;
  nombre: string;
  ip: string;
};

export type DeviceListFilters = {
  projectId: string;
  tipo?: DeviceType;
  gatewayId?: string;
  buscar?: string;
};

export interface DeviceDatasource {
  create(device: NewDevice): Promise<DeviceEntity>;
  list(filters: DeviceListFilters, page: PageRequest): Promise<Page<DeviceEntity>>;
  findById(projectId: string, id: string): Promise<DeviceEntity | null>;
  findByMac(projectId: string, mac: string): Promise<DeviceEntity | null>;
  findByEnrollmentTokenHash(tokenHash: string): Promise<DeviceEntity | null>;
  findEnrollmentData(id: string): Promise<{
    tokenExpiresAt: Date | null;
    durationDays: number | null;
  } | null>;
  update(projectId: string, id: string, changes: DeviceValues): Promise<DeviceEntity | null>;
  updateEnrollmentToken(
    projectId: string,
    id: string,
    tokenHash: string,
    expiresAt: Date,
    enrollmentDurationDays: number | null,
  ): Promise<DeviceEntity | null>;
  countTerminals(gatewayId: string): Promise<number>;
  completeEnrollment(
    id: string,
    deviceTokenHash: string,
    fingerprint: string,
    enrolledAt: Date,
    expiresAt: Date | null,
  ): Promise<DeviceEntity>;
  delete(projectId: string, id: string): Promise<DeviceEntity | null>;
}
