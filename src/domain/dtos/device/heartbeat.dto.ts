import { isUuid } from "../../helpers/uuid";
import { isValidIpv4, normalizeMac } from "../../policies/device/device-policy";

const HEARTBEAT_FIELDS = new Set(["version", "ip", "terminales", "resultados"]);
const TERMINAL_FIELDS = new Set(["mac", "ip", "modelo", "enLinea", "ultimaConexion"]);
const RESULT_FIELDS = new Set(["id", "ok", "error", "datos"]);
const MAX_TERMINALS = 256;
const MAX_RESULTS = 100;

/** A terminal the gateway has on its local network, identified by its MAC. */
export type ReportedTerminal = {
  mac: string;
  ip: string;
  modelo?: string;
  /** The terminal is talking to the gateway (defaults to true: it is being reported). */
  enLinea: boolean;
  ultimaConexion?: Date;
};

/** The outcome of a command the gateway received in an earlier heartbeat. */
export type CommandResult = {
  id: string;
  ok: boolean;
  error: string;
  datos: Record<string, unknown>;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const extraFields = (value: Record<string, unknown>, allowed: Set<string>) =>
  Object.keys(value).filter((key) => !allowed.has(key));

const readTerminal = (value: unknown, index: number): [string?, ReportedTerminal?] => {
  const at = `'terminales[${index}]'`;
  if (!isObject(value)) return [`${at} debe ser un objeto`];
  const extra = extraFields(value, TERMINAL_FIELDS);
  if (extra.length > 0) return [`${at}: campos no permitidos: ${extra.join(", ")}`];
  const mac = normalizeMac(value.mac);
  if (!mac) return [`${at}.mac debe tener el formato AA:BB:CC:DD:EE:FF`];
  if (!isValidIpv4(value.ip)) return [`${at}.ip debe ser una IPv4 válida`];
  if (value.modelo !== undefined && (typeof value.modelo !== "string" || value.modelo.length > 100)) {
    return [`${at}.modelo debe ser texto de máximo 100 caracteres`];
  }
  if (value.enLinea !== undefined && typeof value.enLinea !== "boolean") return [`${at}.enLinea debe ser boolean`];
  let ultimaConexion: Date | undefined;
  if (value.ultimaConexion !== undefined) {
    ultimaConexion = typeof value.ultimaConexion === "number" || typeof value.ultimaConexion === "string"
      ? new Date(value.ultimaConexion)
      : undefined;
    if (!ultimaConexion || Number.isNaN(ultimaConexion.getTime())) {
      return [`${at}.ultimaConexion debe ser una fecha (ISO o milisegundos)`];
    }
  }
  return [
    undefined,
    {
      mac,
      ip: String(value.ip).trim(),
      ...(typeof value.modelo === "string" && value.modelo.trim() ? { modelo: value.modelo.trim() } : {}),
      enLinea: value.enLinea !== false,
      ...(ultimaConexion ? { ultimaConexion } : {}),
    },
  ];
};

const readResult = (value: unknown, index: number): [string?, CommandResult?] => {
  const at = `'resultados[${index}]'`;
  if (!isObject(value)) return [`${at} debe ser un objeto`];
  const extra = extraFields(value, RESULT_FIELDS);
  if (extra.length > 0) return [`${at}: campos no permitidos: ${extra.join(", ")}`];
  if (!isUuid(value.id)) return [`${at}.id debe ser el id del comando`];
  if (typeof value.ok !== "boolean") return [`${at}.ok debe ser boolean`];
  if (value.error !== undefined && (typeof value.error !== "string" || value.error.length > 500)) {
    return [`${at}.error debe ser texto de máximo 500 caracteres`];
  }
  if (value.datos !== undefined && !isObject(value.datos)) return [`${at}.datos debe ser un objeto`];
  return [
    undefined,
    {
      id: value.id,
      ok: value.ok,
      error: typeof value.error === "string" ? value.error.trim() : "",
      datos: isObject(value.datos) ? value.datos : {},
    },
  ];
};

const readList = <T>(
  value: unknown,
  field: string,
  max: number,
  read: (item: unknown, index: number) => [string?, T?],
): [string?, T[]?] => {
  if (value === undefined) return [undefined, undefined];
  if (!Array.isArray(value)) return [`'${field}' debe ser un arreglo`];
  if (value.length > max) return [`'${field}' admite máximo ${max} elementos`];
  const items: T[] = [];
  for (const [index, item] of value.entries()) {
    const [error, parsed] = read(item, index);
    if (error) return [error];
    items.push(parsed!);
  }
  return [undefined, items];
};

/**
 * Body of POST /api/v1/device/heartbeat. Everything is optional so the Raspberry can send the
 * minimum: `terminales` only when they change and `resultados` only after running commands.
 */
export class HeartbeatDto {
  private constructor(
    public readonly version: string | undefined,
    public readonly ip: string | undefined,
    public readonly terminales: ReportedTerminal[] | undefined,
    public readonly resultados: CommandResult[],
  ) {}

  static create(body: Record<string, unknown>): [string?, HeartbeatDto?] {
    const extra = extraFields(body, HEARTBEAT_FIELDS);
    if (extra.length > 0) return [`Campos no permitidos: ${extra.join(", ")}`];

    if (body.version !== undefined && (typeof body.version !== "string" || body.version.length > 50)) {
      return ["'version' debe ser texto de máximo 50 caracteres"];
    }
    if (body.ip !== undefined && !isValidIpv4(body.ip)) return ["'ip' debe ser una IPv4 válida"];
    const [terminalsError, terminales] = readList(body.terminales, "terminales", MAX_TERMINALS, readTerminal);
    if (terminalsError) return [terminalsError];
    const [resultsError, resultados] = readList(body.resultados, "resultados", MAX_RESULTS, readResult);
    if (resultsError) return [resultsError];
    const macs = new Set(terminales?.map((terminal) => terminal.mac));
    if (terminales && macs.size !== terminales.length) return ["'terminales' tiene MAC repetidas"];

    return [
      undefined,
      new HeartbeatDto(
        typeof body.version === "string" ? body.version.trim() || undefined : undefined,
        typeof body.ip === "string" ? body.ip.trim() : undefined,
        terminales,
        resultados ?? [],
      ),
    ];
  }
}
