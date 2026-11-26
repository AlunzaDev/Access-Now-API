import type { DeviceValues } from "../../dtos/device/device-fields";
import type { Page, PageRequest } from "../../dtos/shared/pagination";
import type { DeviceEvent, DeviceEventType } from "../../entities/device/device-event.entity";
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

/** A gateway found by its operational token, with what the API needs to accept it. */
export type GatewayCredentials = {
  device: DeviceEntity;
  fingerprint: string | null;
  enrolledAt: Date | null;
  expiresAt: Date | null;
};

export type HeartbeatData = { at: Date; version?: string; ip?: string };

export interface DeviceDatasource {
  create(device: NewDevice): Promise<DeviceEntity>;
  list(filters: DeviceListFilters, page: PageRequest): Promise<Page<DeviceEntity>>;
  findById(projectId: string, id: string): Promise<DeviceEntity | null>;
  findByMac(projectId: string, mac: string): Promise<DeviceEntity | null>;
  findByEnrollmentTokenHash(tokenHash: string): Promise<DeviceEntity | null>;
  findEnrollmentData(id: string): Promise<{
    tokenExpiresAt: Date | null;
    durationDays: number | null;
    enrolledAt: Date | null;
  } | null>;
  findByDeviceTokenHash(tokenHash: string): Promise<GatewayCredentials | null>;
  /** Enrollment dates of a device (for its status). */
  findEnrollmentDates(id: string): Promise<{ enrolledAt: Date | null; expiresAt: Date | null } | null>;
  /** Saves a heartbeat and marks the gateway online; tells whether it already was. */
  recordHeartbeat(id: string, data: HeartbeatData): Promise<{ wasOnline: boolean }>;
  /** Marks offline the online gateways whose last heartbeat is older than `before`; returns their ids. */
  markOfflineBefore(before: Date): Promise<string[]>;
  /** Appends to the immutable history. */
  addEvent(deviceId: string, tipo: DeviceEventType, detalle?: Record<string, unknown>): Promise<void>;
  listEvents(deviceId: string, page: PageRequest): Promise<Page<DeviceEvent>>;
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
