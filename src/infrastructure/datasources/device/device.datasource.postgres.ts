import type {
  DeviceDatasource,
  DeviceListFilters,
  GatewayCredentials,
  HeartbeatData,
  NewDevice,
  PreviousHeartbeat,
  TerminalReport,
} from "../../../domain/datasources/device/device.datasource";
import type { DeviceValues } from "../../../domain/dtos/device/device-fields";
import { toPage, type Page, type PageRequest } from "../../../domain/dtos/shared/pagination";
import { DeviceEntity, type DeviceConfigStatus } from "../../../domain/entities/device/device.entity";
import type { DeviceEvent, DeviceEventType } from "../../../domain/entities/device/device-event.entity";
import type { Device, Prisma } from "../../../generated/prisma/client";
import { PostgresDatabase } from "../../prisma/postgres.database";
import { currentAuditWrite } from "../../../config/audit-context";
import { isUuid, withPrismaErrors } from "../../prisma/prisma-errors";

const toEntity = (row: Device): DeviceEntity =>
  DeviceEntity.fromObject({
    id: row.id,
    projectId: row.projectId,
    tipo: row.tipo,
    nombre: row.nombre,
    ip: row.ip,
    mac: row.mac,
    modelo: row.modelo,
    estado: row.estado,
    gatewayId: row.gatewayId,
    carril: row.carril,
    sentido: row.sentido,
    configEstado: row.configEstado,
    configError: row.configError,
    urlRemota: row.urlRemota,
    version: row.version,
    ultimaConexion: row.ultimaConexion,
    enLinea: row.enLinea,
    enrolledAt: row.enrolledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    creadoPorId: row.creadoPorId,
    creadoPorNombre: row.creadoPorNombre,
    actualizadoPorId: row.actualizadoPorId,
    actualizadoPorNombre: row.actualizadoPorNombre,
  });

const whereOf = ({ projectId, tipo, gatewayId, buscar }: DeviceListFilters): Prisma.DeviceWhereInput => ({
  projectId,
  ...(tipo ? { tipo } : {}),
  ...(gatewayId ? { gatewayId } : {}),
  ...(buscar
    ? {
        OR: [
          { nombre: { contains: buscar, mode: "insensitive" } },
          { ip: { contains: buscar, mode: "insensitive" } },
          { mac: { contains: buscar, mode: "insensitive" } },
          { modelo: { contains: buscar, mode: "insensitive" } },
        ],
      }
    : {}),
});

export class DevicePostgresDatasource implements DeviceDatasource {
  private get devices() {
    return PostgresDatabase.client.device;
  }

  async create(device: NewDevice): Promise<DeviceEntity> {
    const audit = currentAuditWrite();
    const row = await withPrismaErrors(() =>
      this.devices.create({
        data: {
          projectId: device.projectId,
          tipo: device.tipo,
          nombre: device.nombre,
          ip: device.ip,
          mac: device.mac,
          modelo: device.modelo ?? "",
          estado: device.estado ?? true,
          gatewayId: device.gatewayId,
          carril: device.carril,
          sentido: device.sentido,
          urlRemota: device.urlRemota ?? "",
          version: device.version ?? "",
          ...(device.configEstado ? { configEstado: device.configEstado } : {}),
          creadoPorId: audit.actorId,
          creadoPorNombre: audit.actorNombre,
          actualizadoPorId: audit.actorId,
          actualizadoPorNombre: audit.actorNombre,
        },
      }),
    );
    return toEntity(row);
  }

  async list(filters: DeviceListFilters, { desde, limite }: PageRequest): Promise<Page<DeviceEntity>> {
    const where = whereOf(filters);
    const [rows, total] = await Promise.all([
      this.devices.findMany({
        where,
        orderBy: [{ tipo: "asc" }, { nombre: "asc" }, { id: "asc" }],
        skip: desde,
        take: limite,
      }),
      this.devices.count({ where }),
    ]);
    return toPage(rows.map(toEntity), total);
  }

  async findById(projectId: string, id: string): Promise<DeviceEntity | null> {
    if (!isUuid(id)) return null;
    const row = await this.devices.findFirst({ where: { id, projectId } });
    return row ? toEntity(row) : null;
  }

  async findByMac(projectId: string, mac: string): Promise<DeviceEntity | null> {
    const row = await this.devices.findFirst({ where: { projectId, mac } });
    return row ? toEntity(row) : null;
  }

  async findByEnrollmentTokenHash(tokenHash: string): Promise<DeviceEntity | null> {
    const row = await this.devices.findFirst({ where: { enrollmentTokenHash: tokenHash } });
    return row ? toEntity(row) : null;
  }

  async findEnrollmentData(id: string) {
    const row = await this.devices.findUnique({
      where: { id },
      select: { enrollmentTokenExpiresAt: true, enrollmentDurationDays: true, enrolledAt: true },
    });
    return row ? {
      tokenExpiresAt: row.enrollmentTokenExpiresAt,
      durationDays: row.enrollmentDurationDays,
      enrolledAt: row.enrolledAt,
    } : null;
  }

  async update(projectId: string, id: string, changes: DeviceValues): Promise<DeviceEntity | null> {
    const existing = await this.findById(projectId, id);
    if (!existing) return null;
    const audit = currentAuditWrite();
    const row = await withPrismaErrors(() =>
      this.devices.update({
        where: { id },
        data: {
          ...changes,
          actualizadoPorId: audit.actorId,
          actualizadoPorNombre: audit.actorNombre,
        },
      }),
    );
    return toEntity(row);
  }

  async updateEnrollmentToken(
    projectId: string,
    id: string,
    tokenHash: string,
    expiresAt: Date,
    enrollmentDurationDays: number | null,
  ): Promise<DeviceEntity | null> {
    const existing = await this.findById(projectId, id);
    if (!existing) return null;
    const audit = currentAuditWrite();
    const row = await this.devices.update({
      where: { id },
      data: {
        enrollmentTokenHash: tokenHash,
        enrollmentTokenExpiresAt: expiresAt,
        enrollmentDurationDays,
        actualizadoPorId: audit.actorId,
        actualizadoPorNombre: audit.actorNombre,
      },
    });
    return toEntity(row);
  }

  countTerminals(gatewayId: string): Promise<number> {
    return this.devices.count({ where: { gatewayId } });
  }

  async completeEnrollment(
    id: string,
    deviceTokenHash: string,
    fingerprint: string,
    enrolledAt: Date,
    expiresAt: Date | null,
  ): Promise<DeviceEntity> {
    const row = await this.devices.update({
      where: { id },
      data: {
        deviceTokenHash,
        deviceFingerprint: fingerprint,
        enrolledAt,
        enrollmentExpiresAt: expiresAt,
        enrollmentTokenHash: null,
        enrollmentTokenExpiresAt: null,
        ultimaConexion: enrolledAt,
        enLinea: true,
      },
    });
    return toEntity(row);
  }

  async delete(projectId: string, id: string): Promise<DeviceEntity | null> {
    const existing = await this.findById(projectId, id);
    if (!existing) return null;
    await withPrismaErrors(() => this.devices.delete({ where: { id } }));
    return existing;
  }

  async findByDeviceTokenHash(tokenHash: string): Promise<GatewayCredentials | null> {
    const row = await this.devices.findFirst({
      where: { deviceTokenHash: tokenHash, tipo: "GATEWAY" },
      include: { project: { select: { id: true, nombre: true, clave: true } } },
    });
    if (!row) return null;
    return {
      device: toEntity(row),
      project: row.project,
      fingerprint: row.deviceFingerprint,
      enrolledAt: row.enrolledAt,
      expiresAt: row.enrollmentExpiresAt,
    };
  }

  async findEnrollmentDates(id: string) {
    if (!isUuid(id)) return null;
    const row = await this.devices.findUnique({
      where: { id },
      select: { enrolledAt: true, enrollmentExpiresAt: true },
    });
    return row ? { enrolledAt: row.enrolledAt, expiresAt: row.enrollmentExpiresAt } : null;
  }

  async recordHeartbeat(id: string, { at, version, ip, sourceIp }: HeartbeatData): Promise<PreviousHeartbeat> {
    return PostgresDatabase.client.$transaction(async (tx) => {
      const current = await tx.device.findUniqueOrThrow({
        where: { id },
        select: { enLinea: true, ultimaIpOrigen: true, ultimaConexion: true },
      });
      await tx.device.update({
        where: { id },
        data: {
          ultimaConexion: at,
          enLinea: true,
          ultimaIpOrigen: sourceIp,
          ...(version ? { version } : {}),
          ...(ip ? { ip } : {}),
        },
      });
      return { wasOnline: current.enLinea, sourceIp: current.ultimaIpOrigen, seenAt: current.ultimaConexion };
    });
  }

  async lastEventAt(deviceId: string, tipo: DeviceEventType): Promise<Date | null> {
    const row = await PostgresDatabase.client.deviceEvent.findFirst({
      where: { deviceId, tipo },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    return row?.createdAt ?? null;
  }

  async revokeEnrollment(id: string): Promise<void> {
    await this.devices.update({
      where: { id },
      data: {
        deviceTokenHash: null,
        deviceFingerprint: null,
        enrolledAt: null,
        enrollmentExpiresAt: null,
        enrollmentTokenHash: null,
        enrollmentTokenExpiresAt: null,
        enLinea: false,
        ultimaIpOrigen: null,
      },
    });
  }

  async markOfflineBefore(before: Date): Promise<string[]> {
    const stale = await this.devices.findMany({
      where: { tipo: "GATEWAY", enLinea: true, ultimaConexion: { lt: before } },
      select: { id: true },
    });
    const ids = stale.map((row) => row.id);
    if (ids.length === 0) return [];
    await PostgresDatabase.client.$transaction([
      this.devices.updateMany({ where: { id: { in: ids }, enLinea: true }, data: { enLinea: false } }),
      this.devices.updateMany({ where: { gatewayId: { in: ids }, enLinea: true }, data: { enLinea: false } }),
    ]);
    return ids;
  }

  async listTerminals(gatewayId: string): Promise<DeviceEntity[]> {
    const rows = await this.devices.findMany({
      where: { gatewayId, tipo: "TERMINAL" },
      orderBy: [{ nombre: "asc" }, { id: "asc" }],
    });
    return rows.map(toEntity);
  }

  async recordTerminalReport(id: string, { gatewayId, ip, modelo, enLinea, ultimaConexion }: TerminalReport): Promise<void> {
    await this.devices.update({
      where: { id },
      data: {
        gatewayId,
        ip,
        enLinea,
        ...(modelo ? { modelo } : {}),
        ...(ultimaConexion ? { ultimaConexion } : enLinea ? { ultimaConexion: new Date() } : {}),
      },
    });
  }

  async markTerminalsOffline(gatewayId: string, exceptIds: string[]): Promise<void> {
    await this.devices.updateMany({
      where: { gatewayId, tipo: "TERMINAL", enLinea: true, id: { notIn: exceptIds } },
      data: { enLinea: false },
    });
  }

  async setConfigStatus(ids: string[], configEstado: DeviceConfigStatus, configError = ""): Promise<void> {
    if (ids.length === 0) return;
    await this.devices.updateMany({ where: { id: { in: ids } }, data: { configEstado, configError } });
  }

  async addEvent(deviceId: string, tipo: DeviceEventType, detalle: Record<string, unknown> = {}): Promise<void> {
    const actor = currentAuditWrite();
    await PostgresDatabase.client.deviceEvent.create({
      data: {
        deviceId,
        tipo,
        detalle: detalle as Prisma.InputJsonObject,
        actorId: actor.actorId,
        actorNombre: actor.actorNombre,
      },
    });
  }

  async listEvents(deviceId: string, { desde, limite }: PageRequest): Promise<Page<DeviceEvent>> {
    const events = PostgresDatabase.client.deviceEvent;
    const where = { deviceId };
    const [rows, total] = await Promise.all([
      events.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: desde, take: limite }),
      events.count({ where }),
    ]);
    return toPage(
      rows.map((row) => ({
        id: row.id,
        tipo: row.tipo,
        detalle: (row.detalle ?? {}) as Record<string, unknown>,
        creadoEn: row.createdAt.getTime(),
        actor: { id: row.actorId, nombre: row.actorNombre },
      })),
      total,
    );
  }
}
