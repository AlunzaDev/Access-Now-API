import { createHash, randomBytes } from "node:crypto";
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
const DAY_MS = 24 * 60 * 60 * 1000;

/** What the Raspberry keeps from its enrollment: who it is, where it belongs and how often to report. */
export type GatewaySettings = {
  proyecto: { id: string; nombre: string; clave: string };
  gateway: { id: string; nombre: string };
  intervaloSegundos: number;
};

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

  /**
   * Exchanges a one-time enrollment token for the operational one (SCAT-compatible answer). The
   * token itself stays opaque: what the Raspberry must know travels in `service.settings`. A new
   * or reinstalled Raspberry starts empty, so it also gets a SINCRONIZAR with its terminals.
   */
  async enroll(token: string, fingerprint: string, deviceName: string) {
    const device = await this.devices.findByEnrollmentTokenHash(hashToken(token));
    if (!device || device.tipo !== "GATEWAY") throw CustomError.badRequest("Invalid token");
    const stored = await this.devices.findEnrollmentData(device.id);
    if (!stored?.tokenExpiresAt || stored.tokenExpiresAt.getTime() <= Date.now()) {
      throw CustomError.badRequest("Invalid token");
    }
    const operationalToken = randomBytes(32).toString("hex");
    const enrolledAt = new Date();
    const expiresAt = stored.durationDays === null ? null : new Date(enrolledAt.getTime() + stored.durationDays * DAY_MS);
    await this.devices.completeEnrollment(device.id, hashToken(operationalToken), fingerprint, enrolledAt, expiresAt);
    await this.devices.addEvent(device.id, stored.enrolledAt ? "REENROLADO" : "ENROLADO", {
      fingerprint,
      nombreDispositivo: deviceName,
      expiraEn: expiresAt?.getTime() ?? null,
    });
    await this.commands.syncGateway(device);

    const credentials = await this.devices.findByDeviceTokenHash(hashToken(operationalToken));
    if (!credentials) throw CustomError.internalServer("No se pudo completar el enrolamiento");
    return {
      token_type: "bearer",
      token: operationalToken,
      service: {
        type: "online",
        device: { id: device.id, name: deviceName, fingerprint },
        expires_at: expiresAt?.toISOString() ?? null,
        settings: this.settings(credentials),
      },
    };
  }

  /** Same shape as the enrollment answer, so SCAT can check that its enrollment is still valid. */
  me(credentials: GatewayCredentials) {
    const { device, fingerprint, expiresAt } = credentials;
    return {
      device: { id: device.id, name: device.nombre, fingerprint },
      service: {
        type: "online",
        expires_at: expiresAt?.toISOString() ?? null,
        settings: this.settings(credentials),
      },
    };
  }

  private settings({ device, project }: GatewayCredentials): GatewaySettings {
    return {
      proyecto: project,
      gateway: { id: device.id, nombre: device.nombre },
      intervaloSegundos: this.intervalSeconds,
    };
  }

  private get intervalSeconds(): number {
    return Math.round(this.timing.heartbeatIntervalMs / 1000);
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
      intervaloSegundos: this.intervalSeconds,
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
