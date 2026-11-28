import type { DeviceType } from "../../entities/device/device.entity";

export const normalizeMac = (value: unknown): string | null => {
  const compact = String(value ?? "").trim().replace(/[^0-9a-f]/gi, "").toUpperCase();
  if (!compact) return null;
  if (!/^[0-9A-F]{12}$/.test(compact)) return null;
  return compact.match(/.{2}/g)!.join(":");
};

export const isValidIpv4 = (value: unknown): boolean => {
  const parts = String(value ?? "").trim().split(".");
  return parts.length === 4 && parts.every((part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
};

export type DeviceKindFields = {
  mac?: string | null;
  gatewayId?: string | null;
  puertaId?: string | null;
  sentido?: string | null;
  urlRemota?: string | null;
  version?: string | null;
};

export const validateDeviceKind = (tipo: DeviceType, fields: DeviceKindFields): string | undefined => {
  if (tipo === "TERMINAL") {
    if (!fields.mac) return "'mac' es requerida para una terminal";
    if (!fields.gatewayId) return "'gatewayId' es requerido para una terminal";
    if (!fields.puertaId) return "'puertaId' es requerido para una terminal";
    if (!fields.sentido || !["ENTRADA", "SALIDA", "BIDIRECCIONAL"].includes(fields.sentido)) {
      return "'sentido' debe ser ENTRADA, SALIDA o BIDIRECCIONAL";
    }
    if (fields.urlRemota || fields.version) return "Una terminal no acepta campos de gateway";
    return undefined;
  }
  if (fields.gatewayId || fields.puertaId || fields.sentido) return "Un gateway no acepta campos de terminal";
  return undefined;
};

export const canDeleteGateway = (terminalCount: number): string | undefined =>
  terminalCount > 0 ? "No se puede eliminar un gateway con terminales" : undefined;

export const validateTerminalGateway = (
  projectId: string,
  gateway: { projectId: string; tipo: DeviceType } | null,
): string | undefined =>
  !gateway || gateway.tipo !== "GATEWAY" || gateway.projectId !== projectId
    ? "El gateway debe pertenecer al proyecto y ser de tipo GATEWAY"
    : undefined;
