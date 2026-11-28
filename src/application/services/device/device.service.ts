import { createHash, randomBytes } from "node:crypto";
import type { CreateDeviceDto, Page, PageRequest, UpdateDeviceDto } from "../../../domain/dtos";
import type { DeviceListFilters } from "../../../domain/datasources/device/device.datasource";
import type { DeviceEntity, DeviceType } from "../../../domain/entities/device/device.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import {
  canDeleteGateway,
  validateDeviceKind,
  validateTerminalGateway,
} from "../../../domain/policies/device/device-policy";
import type { DeviceRepository } from "../../../domain/repository/device/device.repository";
import type { DeviceEvent } from "../../../domain/entities/device/device-event.entity";
import type { DeviceStatus } from "../../../domain/entities/device/device-status.entity";
import { enrollmentStatus, isOnline } from "../../../domain/policies/device/device-presence-policy";
import type { DeviceCommand } from "../../../domain/entities/device/device-command.entity";
import type { DeviceCommandService } from "./device-command.service";
import type { VenueRepository } from "../../../domain/repository/venue/venue.repository";

const HOUR_MS = 60 * 60 * 1000;
const TOKEN_VALIDITY_HOURS = [1, 24, 168] as const;
const ENROLLMENT_DURATION_DAYS = [30, 90] as const;

export class DeviceService {
  constructor(
    private readonly devices: DeviceRepository,
    private readonly venues: VenueRepository,
    private readonly commands: DeviceCommandService,
    /** A gateway without a heartbeat for this long counts as offline. */
    private readonly offlineAfterMs: number,
  ) {}

  async create(projectId: string, dto: CreateDeviceDto): Promise<DeviceEntity> {
    await this.validateMac(projectId, dto.values.mac);
    await this.validateGateway(projectId, dto.values.tipo, dto.values.gatewayId);
    await this.validateDoor(projectId, dto.values.tipo, dto.values.puertaId);
    const created = await this.devices.create({ projectId, ...dto.values });
    if (created.tipo !== "TERMINAL") return created;
    await this.commands.applyTerminalChange(null, created);
    return this.findDevice(projectId, created.id);
  }

  list(
    projectId: string,
    filters: Omit<DeviceListFilters, "projectId">,
    page: PageRequest,
  ): Promise<Page<DeviceEntity>> {
    return this.devices.list({ projectId, ...filters }, page);
  }

  async getById(projectId: string, id: string): Promise<DeviceEntity> {
    return this.findDevice(projectId, id);
  }

  async update(projectId: string, id: string, dto: UpdateDeviceDto): Promise<DeviceEntity> {
    const current = await this.findDevice(projectId, id);
    if (dto.values.tipo && dto.values.tipo !== current.tipo) {
      throw CustomError.badRequest("No se puede cambiar el tipo de un dispositivo");
    }
    const values = { ...current.values, ...dto.values, tipo: current.tipo };
    const kindError = validateDeviceKind(current.tipo, values);
    if (kindError) throw CustomError.badRequest(kindError);
    await this.validateMac(projectId, values.mac, id);
    await this.validateGateway(projectId, current.tipo, values.gatewayId);
    await this.validateDoor(projectId, current.tipo, values.puertaId);
    const updated = await this.devices.update(projectId, id, dto.values);
    if (!updated) throw CustomError.notFound("Dispositivo no encontrado");
    if (updated.tipo !== "TERMINAL") return updated;
    await this.commands.applyTerminalChange(current, updated);
    return this.findDevice(projectId, id);
  }

  async delete(projectId: string, id: string): Promise<DeviceEntity> {
    const device = await this.findDevice(projectId, id);
    if (device.tipo === "GATEWAY") {
      const error = canDeleteGateway(await this.devices.countTerminals(device.id));
      if (error) throw CustomError.conflict(error);
    } else {
      // Queued before deleting: the command keeps what to remove even once the terminal is gone.
      await this.commands.applyTerminalChange(device, null);
    }
    const deleted = await this.devices.delete(projectId, id);
    if (!deleted) throw CustomError.notFound("Dispositivo no encontrado");
    return deleted;
  }

  async createEnrollmentToken(
    projectId: string,
    id: string,
    options: { vigenciaHoras: number; duracionEnrolamientoDias: number | null },
  ): Promise<{ token: string; expiraEn: number; duracionEnrolamientoDias: number | null }> {
    const device = await this.findDevice(projectId, id);
    if (device.tipo !== "GATEWAY") {
      throw CustomError.badRequest("Solo un gateway puede generar un token de enrolamiento");
    }
    if (!TOKEN_VALIDITY_HOURS.includes(options.vigenciaHoras as 1 | 24 | 168)) {
      throw CustomError.badRequest("La vigencia del token debe ser 1, 24 o 168 horas");
    }
    if (
      options.duracionEnrolamientoDias !== null
      && !ENROLLMENT_DURATION_DAYS.includes(options.duracionEnrolamientoDias as 30 | 90)
    ) {
      throw CustomError.badRequest("La duración del enrolamiento debe ser 30, 90 días o sin vencimiento");
    }
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + options.vigenciaHoras * HOUR_MS);
    await this.devices.updateEnrollmentToken(
      projectId,
      id,
      tokenHash,
      expiresAt,
      options.duracionEnrolamientoDias,
    );
    await this.devices.addEvent(id, "TOKEN_GENERADO", {
      vigenciaHoras: options.vigenciaHoras,
      duracionEnrolamientoDias: options.duracionEnrolamientoDias,
      expiraEn: expiresAt.getTime(),
    });
    return {
      token,
      expiraEn: expiresAt.getTime(),
      duracionEnrolamientoDias: options.duracionEnrolamientoDias,
    };
  }

  /**
   * Real status: a gateway is online only with a recent heartbeat; a terminal, only when that
   * gateway is online and reports the terminal reachable.
   */
  async status(projectId: string, id: string): Promise<DeviceStatus> {
    const device = await this.findDevice(projectId, id);
    const now = Date.now();
    // Without an enrollment nothing can authenticate it, whatever its last heartbeat says.
    const online = (target: DeviceEntity) =>
      target.enrolado && isOnline(target.ultimaConexion, now, this.offlineAfterMs);

    if (device.tipo === "GATEWAY") {
      const dates = await this.devices.findEnrollmentDates(device.id);
      return {
        tipo: device.tipo,
        enLinea: online(device),
        ultimaConexion: device.ultimaConexion,
        umbralFueraDeLineaMs: this.offlineAfterMs,
        enrolamiento: enrollmentStatus(
          dates?.enrolledAt?.getTime() ?? null,
          dates?.expiresAt?.getTime() ?? null,
          now,
        ),
        configEstado: device.configEstado,
        configError: device.configError,
        gateway: null,
      };
    }

    const gateway = device.gatewayId ? await this.devices.findById(projectId, device.gatewayId) : null;
    return {
      tipo: device.tipo,
      enLinea: gateway ? online(gateway) && device.enLinea : false,
      ultimaConexion: device.ultimaConexion,
      umbralFueraDeLineaMs: this.offlineAfterMs,
      enrolamiento: null,
      configEstado: device.configEstado,
      configError: device.configError,
      gateway: gateway ? { id: gateway.id, nombre: gateway.nombre, enLinea: online(gateway) } : null,
    };
  }

  async history(projectId: string, id: string, page: PageRequest): Promise<Page<DeviceEvent>> {
    await this.findDevice(projectId, id);
    return this.devices.listEvents(id, page);
  }

  /**
   * Cuts a gateway's access without deleting or deactivating it: its operational token and any
   * unused enrollment token stop working. It must enroll again with a new token.
   */
  async revokeEnrollment(projectId: string, id: string): Promise<DeviceEntity> {
    const device = await this.findDevice(projectId, id);
    if (device.tipo !== "GATEWAY") throw CustomError.badRequest("Solo se puede revocar el enrolamiento de un gateway");
    const stored = await this.devices.findEnrollmentData(device.id);
    const pendingToken = Boolean(stored?.tokenExpiresAt && stored.tokenExpiresAt.getTime() > Date.now());
    if (!device.enrolado && !pendingToken) {
      throw CustomError.conflict("El gateway no está enrolado ni tiene un token de enrolamiento vigente");
    }
    await this.devices.revokeEnrollment(device.id);
    await this.devices.addEvent(device.id, "REVOCADO", { estabaEnrolado: device.enrolado, tokenPendiente: pendingToken });
    return this.findDevice(projectId, id);
  }

  /** Gateway: SINCRONIZAR with all its active terminals. Terminal: configure it again. */
  async sync(projectId: string, id: string): Promise<DeviceCommand> {
    const device = await this.findDevice(projectId, id);
    if (device.tipo === "TERMINAL") return this.commands.reapplyTerminal(device);
    const command = await this.commands.syncGateway(device);
    if (!command) throw CustomError.conflict("El gateway no tiene terminales activas que sincronizar");
    return command;
  }

  async listCommands(projectId: string, id: string, page: PageRequest): Promise<Page<DeviceCommand>> {
    return this.commands.list(await this.findDevice(projectId, id), page);
  }

  async cancelCommand(projectId: string, id: string, commandId: string): Promise<DeviceCommand> {
    return this.commands.cancel(await this.findDevice(projectId, id), commandId);
  }

  private async findDevice(projectId: string, id: string): Promise<DeviceEntity> {
    const device = await this.devices.findById(projectId, id);
    if (!device) throw CustomError.notFound("Dispositivo no encontrado");
    return device;
  }

  private async validateMac(projectId: string, mac: string | null | undefined, id?: string) {
    if (!mac) return;
    const existing = await this.devices.findByMac(projectId, mac);
    if (existing && existing.id !== id) {
      throw CustomError.conflict("Ya existe un dispositivo con esa MAC en el proyecto");
    }
  }

  private async validateGateway(
    projectId: string,
    tipo: DeviceType,
    gatewayId: string | null | undefined,
  ) {
    if (tipo !== "TERMINAL") return;
    const gateway = gatewayId ? await this.devices.findById(projectId, gatewayId) : null;
    const error = validateTerminalGateway(projectId, gateway);
    if (error) throw CustomError.badRequest(error);
  }

  private async validateDoor(projectId: string, tipo: DeviceType, puertaId: string | null | undefined) {
    if (tipo !== "TERMINAL") return;
    const door = puertaId ? await this.venues.findDoor(projectId, puertaId) : null;
    if (!door) throw CustomError.badRequest("La puerta debe pertenecer al proyecto");
  }
}
