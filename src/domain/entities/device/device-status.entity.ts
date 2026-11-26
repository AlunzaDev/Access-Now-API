import type { DeviceConfigStatus, DeviceType } from "./device.entity";

/** The enrollment of a gateway as the dashboard shows it. */
export type EnrollmentStatus = {
  activo: boolean;
  enroladoEn: number | null;
  /** null: the enrollment never expires. */
  expiraEn: number | null;
  vencido: boolean;
  vencePronto: boolean;
};

/**
 * Real status of a device. A gateway is online only when its last heartbeat is within the
 * threshold; terminals do not report themselves, so they show their gateway's presence.
 */
export type DeviceStatus = {
  tipo: DeviceType;
  enLinea: boolean;
  ultimaConexion: number | null;
  umbralFueraDeLineaMs: number;
  enrolamiento: EnrollmentStatus | null;
  configEstado: DeviceConfigStatus;
  configError: string;
  gateway: { id: string; nombre: string; enLinea: boolean } | null;
};
