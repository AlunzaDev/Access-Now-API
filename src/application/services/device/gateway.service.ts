import { createHash } from "node:crypto";
import type { GatewayCredentials } from "../../../domain/datasources/device/device.datasource";
import type { HeartbeatDto, ReportedTerminal } from "../../../domain/dtos/device/heartbeat.dto";
import type { DeliveredCommand } from "../../../domain/entities/device/device-command.entity";
import type { DeviceEntity } from "../../../domain/entities/device/device.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import type { DeviceRepository } from "../../../domain/repository/device/device.repository";
import type { DeviceCommandService } from "./device-command.service";

export type HeartbeatAnswer = {
  ok: true;
  serverTime: number;
  /** How often the Raspberry should report; the API can tune it without touching the device. */
  intervaloSegundos: number;
  comandos: DeliveredCommand[];
  /** Results the gateway can forget (also repeated or late ones). */
  resultadosRecibidos: string[];
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * What a gateway (SCAT) does with its operational token: prove who it is, report that it is
 * alive with its terminals, and pick up its commands. Gateways always start the connection (no
 * open ports): every order travels in the answer of a heartbeat.
 */
export class GatewayService {
  constructor(
    private readonly devices: DeviceRepository,
    private readonly commands: DeviceCommandService,
    private readonly timing: { offlineAfterMs: number; heartbeatIntervalMs: number },
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

  /**
   * One heartbeat, in order: presence, results of earlier commands, terminals on the local network
   * (only when they changed), and the commands to run next.
   */
  async heartbeat({ device }: GatewayCredentials, dto: HeartbeatDto): Promise<HeartbeatAnswer> {
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
    const resultadosRecibidos = await this.commands.applyResults(device.id, dto.resultados);
    if (dto.terminales) await this.reportTerminals(device, dto.terminales);
    return {
      ok: true,
      serverTime: Date.now(),
      intervaloSegundos: Math.round(this.timing.heartbeatIntervalMs / 1000),
      comandos: await this.commands.deliver(device.id),
      resultadosRecibidos,
    };
  }

  /**
   * The full list of terminals the gateway has: known MACs get their presence, IP and gateway
   * (the physical truth); unknown ones are registered as already configured; the gateway's
   * terminals missing from the list are offline.
   */
  private async reportTerminals(gateway: DeviceEntity, terminals: ReportedTerminal[]): Promise<void> {
    const seen: string[] = [];
    for (const reported of terminals) {
      const existing = await this.devices.findByMac(gateway.projectId, reported.mac);
      if (existing?.tipo === "GATEWAY") continue;
      const terminal = existing ?? await this.devices.create({
        projectId: gateway.projectId,
        tipo: "TERMINAL",
        nombre: `Terminal ${reported.mac}`,
        ip: reported.ip,
        mac: reported.mac,
        modelo: reported.modelo ?? "",
        gatewayId: gateway.id,
        sentido: "ENTRADA",
        configEstado: "CONFIGURADA",
      });
      await this.devices.recordTerminalReport(terminal.id, { ...reported, gatewayId: gateway.id });
      if (!existing || existing.gatewayId !== gateway.id) {
        await this.devices.addEvent(terminal.id, "TERMINAL_DETECTADA", {
          gateway: { id: gateway.id, nombre: gateway.nombre },
          gatewayAnteriorId: existing?.gatewayId ?? null,
          ip: reported.ip,
          nueva: !existing,
        });
      }
      seen.push(terminal.id);
    }
    await this.devices.markTerminalsOffline(gateway.id, seen);
  }

  /** Marks offline the gateways that stopped reporting and records DESCONECTADO. Returns how many. */
  async markStaleOffline(nowMs = Date.now()): Promise<number> {
    const ids = await this.devices.markOfflineBefore(new Date(nowMs - this.timing.offlineAfterMs));
    for (const id of ids) {
      await this.devices.addEvent(id, "DESCONECTADO", { sinHeartbeatDesdeMs: this.timing.offlineAfterMs });
    }
    return ids.length;
  }
}
