import {
  DEVICE_DIRECTIONS,
  DEVICE_TYPES,
  type DeviceDirection,
  type DeviceType,
} from "../../entities/device/device.entity";
import { isValidIpv4, normalizeMac, validateDeviceKind } from "../../policies/device/device-policy";
import { unknownFields } from "../user/user-fields";

export const DEVICE_FIELDS = new Set([
  "tipo",
  "nombre",
  "ip",
  "mac",
  "modelo",
  "estado",
  "gatewayId",
  "puertaId",
  "sentido",
  "urlRemota",
  "version",
]);

export type DeviceValues = {
  tipo?: DeviceType;
  nombre?: string;
  ip?: string;
  mac?: string | null;
  modelo?: string;
  estado?: boolean;
  gatewayId?: string | null;
  puertaId?: string | null;
  sentido?: DeviceDirection | null;
  urlRemota?: string;
  version?: string;
};

export const readDevice = (
  body: Record<string, unknown>,
  required: boolean,
): [string?, DeviceValues?] => {
  const extra = unknownFields(body, DEVICE_FIELDS);
  if (extra.length > 0) return [`Campos no permitidos: ${extra.join(", ")}`];
  const values: DeviceValues = {};

  if (body.tipo !== undefined || required) {
    if (!DEVICE_TYPES.includes(body.tipo as DeviceType)) return ["'tipo' debe ser GATEWAY o TERMINAL"];
    values.tipo = body.tipo as DeviceType;
  }
  if (body.nombre !== undefined || required) {
    if (typeof body.nombre !== "string" || !body.nombre.trim()) return ["'nombre' es requerido"];
    values.nombre = body.nombre.trim();
  }
  if (body.ip !== undefined || required) {
    if (!isValidIpv4(body.ip)) return ["'ip' debe ser una dirección IPv4 válida"];
    values.ip = String(body.ip).trim();
  }
  if (body.mac !== undefined) {
    if (body.mac === null || body.mac === "") values.mac = null;
    else {
      const mac = normalizeMac(body.mac);
      if (!mac) return ["'mac' debe tener el formato AA:BB:CC:DD:EE:FF"];
      values.mac = mac;
    }
  }
  for (const field of ["modelo", "urlRemota", "version"] as const) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== "string") return [`'${field}' debe ser texto`];
    values[field] = body[field].trim();
  }
  if (body.estado !== undefined) {
    if (typeof body.estado !== "boolean") return ["'estado' debe ser boolean"];
    values.estado = body.estado;
  }
  if (body.gatewayId !== undefined) {
    if (body.gatewayId !== null && typeof body.gatewayId !== "string") return ["'gatewayId' debe ser texto"];
    values.gatewayId = typeof body.gatewayId === "string" ? body.gatewayId.trim() : null;
  }
  if (body.puertaId !== undefined) {
    if (body.puertaId !== null && typeof body.puertaId !== "string") return ["'puertaId' debe ser texto"];
    values.puertaId = typeof body.puertaId === "string" ? body.puertaId.trim() : null;
  }
  if (body.sentido !== undefined) {
    if (body.sentido !== null && !DEVICE_DIRECTIONS.includes(body.sentido as DeviceDirection)) {
      return ["'sentido' debe ser ENTRADA, SALIDA o BIDIRECCIONAL"];
    }
    values.sentido = body.sentido as DeviceDirection | null;
  }
  if (required) {
    const error = validateDeviceKind(values.tipo!, values);
    if (error) return [error];
  }
  return [undefined, values];
};
