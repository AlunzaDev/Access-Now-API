import type {
  DeviceDatasource,
  DeviceListFilters,
  NewDevice,
} from "../../../domain/datasources/device/device.datasource";
import type { DeviceValues } from "../../../domain/dtos/device/device-fields";
import { toPage, type Page, type PageRequest } from "../../../domain/dtos/shared/pagination";
import { DeviceEntity } from "../../../domain/entities/device/device.entity";
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
      select: { enrollmentTokenExpiresAt: true, enrollmentDurationDays: true },
    });
    return row ? {
      tokenExpiresAt: row.enrollmentTokenExpiresAt,
      durationDays: row.enrollmentDurationDays,
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
}
