import type { DeviceValues } from "../../dtos/device/device-fields";
import type { Page, PageRequest } from "../../dtos/shared/pagination";
import type { DeviceEvent, DeviceEventType } from "../../entities/device/device-event.entity";
import type { DeviceConfigStatus, DeviceEntity, DeviceType } from "../../entities/device/device.entity";

export type NewDevice = DeviceValues & {
  projectId: string;
  tipo: DeviceType;
  nombre: string;
  ip: string;
  /** Only for terminals a gateway reports: they already run on it. */
  configEstado?: DeviceConfigStatus;
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
  project: { id: string; nombre: string; clave: string };
  fingerprint: string | null;
  enrolledAt: Date | null;
  expiresAt: Date | null;
};

export type HeartbeatData = { at: Date; version?: string; ip?: string; sourceIp: string };

/** What the gateway looked like before this heartbeat (presence and where it reported from). */
export type PreviousHeartbeat = { wasOnline: boolean; sourceIp: string | null; seenAt: Date | null };

/** What a gateway reports about one of its terminals (the physical truth of the local network). */
export type TerminalReport = {
  gatewayId: string;
  ip: string;
  modelo?: string;
  enLinea: boolean;
  ultimaConexion?: Date;
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
    enrolledAt: Date | null;
  } | null>;
  findByDeviceTokenHash(tokenHash: string): Promise<GatewayCredentials | null>;
  /** Enrollment dates of a device (for its status). */
  findEnrollmentDates(id: string): Promise<{ enrolledAt: Date | null; expiresAt: Date | null } | null>;
  /** Saves a heartbeat and marks the gateway online; returns how it was before. */
  recordHeartbeat(id: string, data: HeartbeatData): Promise<PreviousHeartbeat>;
  /** When the last event of that type was recorded (for alert cooldowns). */
  lastEventAt(deviceId: string, tipo: DeviceEventType): Promise<Date | null>;
  /** Invalidates the operational token and any unused enrollment token; the gateway stays registered. */
  revokeEnrollment(id: string): Promise<void>;
  /**
   * Marks offline the online gateways whose last heartbeat is older than `before`, and their
   * terminals with them (nobody can vouch for them); returns the gateway ids.
   */
  markOfflineBefore(before: Date): Promise<string[]>;
  /** Every terminal of a gateway, active or not. */
  listTerminals(gatewayId: string): Promise<DeviceEntity[]>;
  /** Saves what the gateway reports about a terminal (presence, current IP, model, its gateway). */
  recordTerminalReport(id: string, report: TerminalReport): Promise<void>;
  /** Terminals of the gateway missing from its last full report are no longer reachable. */
  markTerminalsOffline(gatewayId: string, exceptIds: string[]): Promise<void>;
  /** Operational state of the configuration (not an edit: it does not change actualizadoPor). */
  setConfigStatus(ids: string[], configEstado: DeviceConfigStatus, configError?: string): Promise<void>;
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
