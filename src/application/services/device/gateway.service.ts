import { createHash } from "node:crypto";
import type { GatewayCredentials } from "../../../domain/datasources/device/device.datasource";
import type { HeartbeatDto } from "../../../domain/dtos/device/heartbeat.dto";
import { CustomError } from "../../../domain/errors/custom.error";
import type { DeviceRepository } from "../../../domain/repository/device/device.repository";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * What a gateway (SCAT) does with its operational token: prove who it is, report that it is
 * alive and, later, receive commands. Gateways always start the connection (no open ports).
 */
export class GatewayService {
  constructor(
    private readonly devices: DeviceRepository,
    private readonly offlineAfterMs: number,
  ) {}

  /** The gateway behind a bearer token; 401 when unknown, deactivated or its enrollment expired. */
  async authenticate(token: string): Promise<GatewayCredentials> {
    const credentials = token ? await this.devices.findByDeviceTokenHash(hashToken(token)) : null;
    if (!credentials || !credentials.device.estado) throw CustomError.unauthorized("Invalid token");
    if (credentials.expiresAt && credentials.expiresAt.getTime() <= Date.now()) {
      throw CustomError.unauthorized("Enrollment expired");
    }
    return credentials;
  }

  /** Same shape as the enrollment answer, so SCAT can check that its enrollment is still valid. */
  me({ device, fingerprint, expiresAt }: GatewayCredentials) {
    return {
      device: { id: device.id, name: device.nombre, fingerprint },
      service: { type: "online", expires_at: expiresAt?.toISOString() ?? null, settings: {} },
    };
  }

  async heartbeat({ device }: GatewayCredentials, dto: HeartbeatDto) {
    const { wasOnline } = await this.devices.recordHeartbeat(device.id, {
      at: new Date(),
      version: dto.version,
      ip: dto.ip,
    });
    if (!wasOnline) {
      await this.devices.addEvent(device.id, "CONECTADO", {
        ip: dto.ip ?? device.ip,
        version: dto.version ?? device.version,
      });
    }
    // Commands (configure/remove terminals) arrive in a later phase; the list is already in the contract.
    return { ok: true, serverTime: Date.now(), comandos: [] as unknown[] };
  }

  /** Marks offline the gateways that stopped reporting and records DESCONECTADO. Returns how many. */
  async markStaleOffline(nowMs = Date.now()): Promise<number> {
    const ids = await this.devices.markOfflineBefore(new Date(nowMs - this.offlineAfterMs));
    for (const id of ids) {
      await this.devices.addEvent(id, "DESCONECTADO", { sinHeartbeatDesdeMs: this.offlineAfterMs });
    }
    return ids.length;
  }
}
