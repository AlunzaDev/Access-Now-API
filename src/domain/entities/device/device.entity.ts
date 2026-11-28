import { CustomError } from "../../errors/custom.error";
import { auditFieldsFromObject, type AuditFields } from "../shared/audit.entity";

export const DEVICE_TYPES = ["GATEWAY", "TERMINAL"] as const;
export const DEVICE_DIRECTIONS = ["ENTRADA", "SALIDA", "BIDIRECCIONAL"] as const;
export const DEVICE_CONFIG_STATUSES = ["PENDIENTE", "CONFIGURADA", "ERROR", "RETIRADA"] as const;

export type DeviceType = (typeof DEVICE_TYPES)[number];
export type DeviceDirection = (typeof DEVICE_DIRECTIONS)[number];
export type DeviceConfigStatus = (typeof DEVICE_CONFIG_STATUSES)[number];

export type DeviceEntityOptions = AuditFields & {
  id: string;
  projectId: string;
  tipo: DeviceType;
  nombre: string;
  ip: string;
  mac: string | null;
  modelo: string;
  estado: boolean;
  gatewayId: string | null;
  puertaId: string | null;
  sentido: DeviceDirection | null;
  configEstado: DeviceConfigStatus;
  configError: string;
  urlRemota: string;
  version: string;
  ultimaConexion: number | null;
  /** Last presence reported by heartbeats: the gateway's own, or the one its gateway reports for a terminal. */
  enLinea: boolean;
  /** The gateway has an operational token (it enrolled at least once). */
  enrolado: boolean;
};

export class DeviceEntity {
  constructor(public readonly values: DeviceEntityOptions) {}

  get id() { return this.values.id; }
  get projectId() { return this.values.projectId; }
  get tipo() { return this.values.tipo; }
  get nombre() { return this.values.nombre; }
  get ip() { return this.values.ip; }
  get mac() { return this.values.mac; }
  get modelo() { return this.values.modelo; }
  get estado() { return this.values.estado; }
  get gatewayId() { return this.values.gatewayId; }
  get puertaId() { return this.values.puertaId; }
  get sentido() { return this.values.sentido; }
  get configEstado() { return this.values.configEstado; }
  get configError() { return this.values.configError; }
  get urlRemota() { return this.values.urlRemota; }
  get version() { return this.values.version; }
  get ultimaConexion() { return this.values.ultimaConexion; }
  get enLinea() { return this.values.enLinea; }
  get enrolado() { return this.values.enrolado; }

  toJSON() {
    const { projectId: _projectId, ...contract } = this.values;
    return contract;
  }

  static fromObject(object: Record<string, unknown>): DeviceEntity {
    const tipo = String(object.tipo) as DeviceType;
    if (!DEVICE_TYPES.includes(tipo)) throw CustomError.badRequest("Tipo de dispositivo inválido");
    return new DeviceEntity({
      id: String(object.id),
      projectId: String(object.projectId),
      tipo,
      nombre: String(object.nombre),
      ip: String(object.ip),
      mac: typeof object.mac === "string" ? object.mac : null,
      modelo: String(object.modelo ?? ""),
      estado: object.estado !== false,
      gatewayId: typeof object.gatewayId === "string" ? object.gatewayId : null,
      puertaId: typeof object.puertaId === "string" ? object.puertaId : null,
      sentido: DEVICE_DIRECTIONS.includes(object.sentido as DeviceDirection)
        ? (object.sentido as DeviceDirection)
        : null,
      configEstado: DEVICE_CONFIG_STATUSES.includes(object.configEstado as DeviceConfigStatus)
        ? (object.configEstado as DeviceConfigStatus)
        : "PENDIENTE",
      configError: String(object.configError ?? ""),
      urlRemota: String(object.urlRemota ?? ""),
      version: String(object.version ?? ""),
      ultimaConexion: object.ultimaConexion instanceof Date ? object.ultimaConexion.getTime() : null,
      enLinea: object.enLinea === true,
      enrolado: object.enrolledAt instanceof Date,
      ...auditFieldsFromObject(object),
    });
  }
}
