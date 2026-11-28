import type {
  VenueCatalogInput,
  VenueDatasource,
  VenueDoorInput,
} from "../../../domain/datasources/venue/venue.datasource";
import type { VenueDoor, VenueLayout } from "../../../domain/entities/venue/venue.entity";
import type { VenueDoor as VenueDoorRow } from "../../../generated/prisma/client";
import { currentAuditWrite } from "../../../config/audit-context";
import { PostgresDatabase } from "../../prisma/postgres.database";
import { isUuid, withPrismaErrors } from "../../prisma/prisma-errors";

const auditOf = (row: {
  createdAt: Date;
  updatedAt: Date;
  creadoPorId: string | null;
  creadoPorNombre: string;
  actualizadoPorId: string | null;
  actualizadoPorNombre: string;
}) => ({
  creadoEn: row.createdAt.getTime(),
  actualizadoEn: row.updatedAt.getTime(),
  creadoPor: { id: row.creadoPorId, nombre: row.creadoPorNombre },
  actualizadoPor: { id: row.actualizadoPorId, nombre: row.actualizadoPorNombre },
});

const doorEntity = (row: VenueDoorRow & { zones: Array<{ zoneId: string }> }): VenueDoor => ({
  id: row.id,
  projectId: row.projectId,
  nombre: row.nombre,
  descripcion: row.descripcion,
  estado: row.estado,
  zonaIds: row.zones.map((item) => item.zoneId),
  ...auditOf(row),
});

export class VenuePostgresDatasource implements VenueDatasource {
  async getLayout(projectId: string): Promise<VenueLayout> {
    const [zones, doors] = await Promise.all([
      PostgresDatabase.client.venueZone.findMany({
        where: { projectId },
        include: { sections: { include: { rows: { include: { seats: true } } } } },
        orderBy: { nombre: "asc" },
      }),
      PostgresDatabase.client.venueDoor.findMany({
        where: { projectId },
        include: { zones: true },
        orderBy: { nombre: "asc" },
      }),
    ]);
    return {
      zonas: zones.map((zone) => ({
        id: zone.id,
        projectId: zone.projectId,
        nombre: zone.nombre,
        descripcion: zone.descripcion,
        estado: zone.estado,
        ...auditOf(zone),
        secciones: zone.sections.map((section) => ({
          id: section.id,
          nombre: section.nombre,
          descripcion: section.descripcion,
          estado: section.estado,
          ...auditOf(section),
          filas: section.rows.map((row) => ({
            id: row.id,
            nombre: row.nombre,
            estado: row.estado,
            ...auditOf(row),
            asientos: row.seats.map((seat) => ({
              id: seat.id,
              nombre: seat.nombre,
              estado: seat.estado,
              ...auditOf(seat),
            })),
          })),
        })),
      })),
      puertas: doors.map(doorEntity),
    };
  }

  async findDoor(projectId: string, id: string): Promise<VenueDoor | null> {
    if (!isUuid(id)) return null;
    const row = await PostgresDatabase.client.venueDoor.findFirst({
      where: { id, projectId },
      include: { zones: true },
    });
    return row ? doorEntity(row) : null;
  }

  async createDoor(projectId: string, input: VenueDoorInput): Promise<VenueDoor> {
    const audit = currentAuditWrite();
    const row = await withPrismaErrors(() => PostgresDatabase.client.venueDoor.create({
      data: {
        projectId,
        nombre: input.nombre,
        descripcion: input.descripcion,
        estado: input.estado,
        creadoPorId: audit.actorId,
        creadoPorNombre: audit.actorNombre,
        actualizadoPorId: audit.actorId,
        actualizadoPorNombre: audit.actorNombre,
        zones: { create: input.zonaIds.map((zoneId) => ({ zoneId })) },
      },
      include: { zones: true },
    }));
    return doorEntity(row);
  }

  async updateDoor(projectId: string, id: string, input: Partial<VenueDoorInput>): Promise<VenueDoor | null> {
    if (!(await this.findDoor(projectId, id))) return null;
    const audit = currentAuditWrite();
    const row = await withPrismaErrors(() => PostgresDatabase.client.venueDoor.update({
      where: { id },
      data: {
        nombre: input.nombre,
        descripcion: input.descripcion,
        estado: input.estado,
        actualizadoPorId: audit.actorId,
        actualizadoPorNombre: audit.actorNombre,
        ...(input.zonaIds ? {
          zones: {
            deleteMany: {},
            create: input.zonaIds.map((zoneId) => ({ zoneId })),
          },
        } : {}),
      },
      include: { zones: true },
    }));
    return doorEntity(row);
  }

  async deleteDoor(projectId: string, id: string): Promise<VenueDoor | null> {
    const door = await this.findDoor(projectId, id);
    if (!door) return null;
    await withPrismaErrors(() => PostgresDatabase.client.venueDoor.delete({ where: { id } }));
    return door;
  }

  async createZone(projectId: string, input: VenueCatalogInput): Promise<void> {
    const audit = currentAuditWrite();
    await withPrismaErrors(() => PostgresDatabase.client.venueZone.create({
      data: { projectId, ...input, ...this.auditCreate(audit) },
    }));
  }

  async updateZone(projectId: string, id: string, input: Partial<VenueCatalogInput>): Promise<boolean> {
    if (!isUuid(id)) return false;
    const result = await withPrismaErrors(() => PostgresDatabase.client.venueZone.updateMany({
      where: { id, projectId },
      data: { ...input, ...this.auditUpdate() },
    }));
    return result.count > 0;
  }

  async deleteZone(projectId: string, id: string): Promise<boolean> {
    if (!isUuid(id)) return false;
    const result = await withPrismaErrors(() => PostgresDatabase.client.venueZone.deleteMany({
      where: { id, projectId },
    }));
    return result.count > 0;
  }

  async createSection(zoneId: string, input: VenueCatalogInput): Promise<void> {
    const audit = currentAuditWrite();
    await withPrismaErrors(() => PostgresDatabase.client.venueSection.create({
      data: { zoneId, ...input, ...this.auditCreate(audit) },
    }));
  }

  async updateSection(id: string, input: Partial<VenueCatalogInput>): Promise<boolean> {
    return this.updateCatalog("venueSection", id, input);
  }

  async deleteSection(id: string): Promise<boolean> {
    return this.deleteCatalog("venueSection", id);
  }

  async createRow(sectionId: string, input: VenueCatalogInput): Promise<void> {
    const audit = currentAuditWrite();
    await withPrismaErrors(() => PostgresDatabase.client.venueRow.create({
      data: {
        sectionId,
        nombre: input.nombre,
        estado: input.estado,
        ...this.auditCreate(audit),
      },
    }));
  }

  async updateRow(id: string, input: Partial<VenueCatalogInput>): Promise<boolean> {
    const { descripcion: _descripcion, ...changes } = input;
    return this.updateCatalog("venueRow", id, changes);
  }

  async deleteRow(id: string): Promise<boolean> {
    return this.deleteCatalog("venueRow", id);
  }

  async createSeat(rowId: string, input: VenueCatalogInput): Promise<void> {
    const audit = currentAuditWrite();
    await withPrismaErrors(() => PostgresDatabase.client.venueSeat.create({
      data: {
        rowId,
        nombre: input.nombre,
        estado: input.estado,
        ...this.auditCreate(audit),
      },
    }));
  }

  async updateSeat(id: string, input: Partial<VenueCatalogInput>): Promise<boolean> {
    const { descripcion: _descripcion, ...changes } = input;
    return this.updateCatalog("venueSeat", id, changes);
  }

  async deleteSeat(id: string): Promise<boolean> {
    return this.deleteCatalog("venueSeat", id);
  }

  private auditCreate(audit: ReturnType<typeof currentAuditWrite>) {
    return {
      creadoPorId: audit.actorId,
      creadoPorNombre: audit.actorNombre,
      actualizadoPorId: audit.actorId,
      actualizadoPorNombre: audit.actorNombre,
    };
  }

  private auditUpdate() {
    const audit = currentAuditWrite();
    return { actualizadoPorId: audit.actorId, actualizadoPorNombre: audit.actorNombre };
  }

  private async updateCatalog(
    model: "venueSection" | "venueRow" | "venueSeat",
    id: string,
    input: Partial<VenueCatalogInput>,
  ): Promise<boolean> {
    if (!isUuid(id)) return false;
    const client = PostgresDatabase.client[model] as unknown as {
      updateMany(args: object): Promise<{ count: number }>;
    };
    const result = await withPrismaErrors(() => client.updateMany({
      where: { id },
      data: { ...input, ...this.auditUpdate() },
    }));
    return result.count > 0;
  }

  private async deleteCatalog(
    model: "venueSection" | "venueRow" | "venueSeat",
    id: string,
  ): Promise<boolean> {
    if (!isUuid(id)) return false;
    const client = PostgresDatabase.client[model] as unknown as {
      deleteMany(args: object): Promise<{ count: number }>;
    };
    const result = await withPrismaErrors(() => client.deleteMany({ where: { id } }));
    return result.count > 0;
  }
}
