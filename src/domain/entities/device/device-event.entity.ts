import type { AuditActor } from "../shared/audit.entity";

export const DEVICE_EVENT_TYPES = [
  "TOKEN_GENERADO",
  "ENROLADO",
  "REENROLADO",
  "CONECTADO",
  "DESCONECTADO",
  "ENROLAMIENTO_VENCIDO",
  "ERROR",
  "TERMINAL_DETECTADA",
] as const;

export type DeviceEventType = (typeof DEVICE_EVENT_TYPES)[number];

/** One entry of a device's history. Immutable: it is only ever inserted. */
export type DeviceEvent = {
  id: string;
  tipo: DeviceEventType;
  detalle: Record<string, unknown>;
  creadoEn: number;
  actor: AuditActor;
};
