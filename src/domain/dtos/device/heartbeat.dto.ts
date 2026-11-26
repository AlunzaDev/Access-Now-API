import { isValidIpv4 } from "../../policies/device/device-policy";

const HEARTBEAT_FIELDS = new Set(["version", "ip", "terminales"]);

/** Body of POST /api/v1/device/heartbeat. `terminales` is accepted now and used with commands later. */
export class HeartbeatDto {
  private constructor(
    public readonly version: string | undefined,
    public readonly ip: string | undefined,
    public readonly terminales: unknown[] | undefined,
  ) {}

  static create(body: Record<string, unknown>): [string?, HeartbeatDto?] {
    const extra = Object.keys(body).filter((key) => !HEARTBEAT_FIELDS.has(key));
    if (extra.length > 0) return [`Campos no permitidos: ${extra.join(", ")}`];

    if (body.version !== undefined && (typeof body.version !== "string" || body.version.length > 50)) {
      return ["'version' debe ser texto de máximo 50 caracteres"];
    }
    if (body.ip !== undefined && !isValidIpv4(body.ip)) return ["'ip' debe ser una IPv4 válida"];
    if (body.terminales !== undefined && !Array.isArray(body.terminales)) {
      return ["'terminales' debe ser un arreglo"];
    }

    return [
      undefined,
      new HeartbeatDto(
        typeof body.version === "string" ? body.version.trim() || undefined : undefined,
        typeof body.ip === "string" ? body.ip.trim() : undefined,
        body.terminales as unknown[] | undefined,
      ),
    ];
  }
}
