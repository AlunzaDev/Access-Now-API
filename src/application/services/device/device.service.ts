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

const HOUR_MS = 60 * 60 * 1000;
const TOKEN_VALIDITY_HOURS = [1, 24, 168] as const;
const ENROLLMENT_DURATION_DAYS = [30, 90] as const;

export class DeviceService {
  constructor(private readonly devices: DeviceRepository) {}

  async create(projectId: string, dto: CreateDeviceDto): Promise<DeviceEntity> {
    await this.validateMac(projectId, dto.values.mac);
    await this.validateGateway(projectId, dto.values.tipo, dto.values.gatewayId);
    return this.devices.create({ projectId, ...dto.values });
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
    const updated = await this.devices.update(projectId, id, dto.values);
    if (!updated) throw CustomError.notFound("Dispositivo no encontrado");
    return updated;
  }

  async delete(projectId: string, id: string): Promise<DeviceEntity> {
    const device = await this.findDevice(projectId, id);
    if (device.tipo === "GATEWAY") {
      const error = canDeleteGateway(await this.devices.countTerminals(device.id));
      if (error) throw CustomError.conflict(error);
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
    return {
      token,
      expiraEn: expiresAt.getTime(),
      duracionEnrolamientoDias: options.duracionEnrolamientoDias,
    };
  }

  async enroll(token: string, fingerprint: string, deviceName: string) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const device = await this.devices.findByEnrollmentTokenHash(tokenHash);
    if (!device || device.tipo !== "GATEWAY") throw CustomError.badRequest("Invalid token");
    const stored = await this.devices.findEnrollmentData(device.id);
    if (!stored?.tokenExpiresAt || stored.tokenExpiresAt.getTime() <= Date.now()) {
      throw CustomError.badRequest("Invalid token");
    }
    const operationalToken = randomBytes(32).toString("hex");
    const enrolledAt = new Date();
    const expiresAt = stored.durationDays === null
      ? null
      : new Date(enrolledAt.getTime() + stored.durationDays * 24 * HOUR_MS);
    await this.devices.completeEnrollment(
      device.id,
      createHash("sha256").update(operationalToken).digest("hex"),
      fingerprint,
      enrolledAt,
      expiresAt,
    );
    return {
      token_type: "bearer",
      token: operationalToken,
      service: {
        type: "online",
        device: { id: device.id, name: deviceName, fingerprint },
        expires_at: expiresAt?.toISOString() ?? null,
        settings: {},
      },
    };
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
}
