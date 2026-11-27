import { currentAuditWrite } from "../../../config/audit-context";
import type { EventDatasource, EventListFilters } from "../../../domain/datasources/event/event.datasource";
import type { EventValues } from "../../../domain/dtos/event/event.dto";
import { toPage, type Page, type PageRequest } from "../../../domain/dtos/shared/pagination";
import { EventEntity } from "../../../domain/entities/event/event.entity";
import type { Event, Prisma } from "../../../generated/prisma/client";
import { PostgresDatabase } from "../../prisma/postgres.database";
import { isUuid, withPrismaErrors } from "../../prisma/prisma-errors";

const utcDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const toEntity = (row: Event) => EventEntity.fromObject({ ...row });

export class EventPostgresDatasource implements EventDatasource {
  private get events() { return PostgresDatabase.client.event; }

  async create(projectId: string, values: EventValues): Promise<EventEntity> {
    const audit = currentAuditWrite();
    const row = await withPrismaErrors(() => this.events.create({ data: {
      ...values,
      projectId,
      fechaInicio: utcDate(values.fechaInicio),
      fechaFin: utcDate(values.fechaFin),
      creadoPorId: audit.actorId,
      creadoPorNombre: audit.actorNombre,
      actualizadoPorId: audit.actorId,
      actualizadoPorNombre: audit.actorNombre,
    } }));
    return toEntity(row);
  }

  async list({ projectId, buscar, estado }: EventListFilters, page: PageRequest): Promise<Page<EventEntity>> {
    const where: Prisma.EventWhereInput = {
      projectId,
      ...(buscar ? { nombre: { contains: buscar, mode: "insensitive" } } : {}),
      ...(estado === undefined ? {} : { estado }),
    };
    const [rows, total] = await Promise.all([
      this.events.findMany({ where, orderBy: [{ fechaInicio: "desc" }, { id: "desc" }], skip: page.desde, take: page.limite }),
      this.events.count({ where }),
    ]);
    return toPage(rows.map(toEntity), total);
  }

  async findById(projectId: string, id: string): Promise<EventEntity | null> {
    if (!isUuid(id)) return null;
    const row = await this.events.findFirst({ where: { id, projectId } });
    return row ? toEntity(row) : null;
  }

  async update(projectId: string, id: string, values: Partial<EventValues>): Promise<EventEntity | null> {
    if (!(await this.findById(projectId, id))) return null;
    const audit = currentAuditWrite();
    const row = await withPrismaErrors(() => this.events.update({ where: { id }, data: {
      ...values,
      fechaInicio: values.fechaInicio ? utcDate(values.fechaInicio) : undefined,
      fechaFin: values.fechaFin ? utcDate(values.fechaFin) : undefined,
      actualizadoPorId: audit.actorId,
      actualizadoPorNombre: audit.actorNombre,
    } }));
    return toEntity(row);
  }

  async delete(projectId: string, id: string): Promise<EventEntity | null> {
    const event = await this.findById(projectId, id);
    if (!event) return null;
    await this.events.delete({ where: { id } });
    return event;
  }
}
