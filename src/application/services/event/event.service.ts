import type { EventListFilters } from "../../../domain/datasources/event/event.datasource";
import type { CreateEventDto, UpdateEventDto } from "../../../domain/dtos/event/event.dto";
import type { PageRequest } from "../../../domain/dtos/shared/pagination";
import { CustomError } from "../../../domain/errors/custom.error";
import { canDeleteEvent, validateEventSchedule } from "../../../domain/policies/event/event-schedule-policy";
import type { EventRepository } from "../../../domain/repository/event/event.repository";
import type { FileStorage, FileUpload } from "../../../domain/ports/storage/file-storage.port";
import type { TicketRepository } from "../../../domain/repository/ticket/ticket.repository";
import { randomUUID } from "node:crypto";

export class EventService {
  constructor(
    private readonly events: EventRepository,
    private readonly storage: FileStorage,
    private readonly tickets: TicketRepository,
  ) {}

  create(projectId: string, dto: CreateEventDto) { return this.events.create(projectId, dto.values); }
  list(filters: EventListFilters, page: PageRequest) { return this.events.list(filters, page); }

  async getById(projectId: string, id: string) {
    const event = await this.events.findById(projectId, id);
    if (!event) throw CustomError.notFound("Evento no encontrado");
    return event;
  }

  async update(projectId: string, id: string, dto: UpdateEventDto) {
    const current = await this.getById(projectId, id);
    const schedule = { ...current.values, ...dto.values };
    const error = validateEventSchedule(schedule);
    if (error) throw CustomError.badRequest(error);
    if (dto.values.capacidad !== undefined && dto.values.capacidad !== null) {
      const activeTickets = await this.tickets.countActive(projectId, id);
      if (dto.values.capacidad < activeTickets) {
        throw CustomError.conflict(`La capacidad no puede ser menor a ${activeTickets} boletos activos`);
      }
    }
    const event = await this.events.update(projectId, id, dto.values);
    if (!event) throw CustomError.notFound("Evento no encontrado");
    return event;
  }

  async delete(projectId: string, id: string) {
    const current = await this.getById(projectId, id);
    const error = canDeleteEvent(await this.tickets.countByEvent(projectId, id));
    if (error) throw CustomError.conflict(error);
    const event = await this.events.delete(projectId, id);
    if (!event) throw CustomError.notFound("Evento no encontrado");
    await this.storage.deleteByUrl(current.values.img);
    return event;
  }

  async uploadImage(projectId: string, id: string, file: FileUpload) {
    const event = await this.getById(projectId, id);
    const extension = file.contentType === "image/png" ? "png" : file.contentType === "image/webp" ? "webp" : "jpg";
    const saved = await this.storage.save({
      buffer: file.buffer,
      folder: `eventos/${id}`,
      fileName: `${randomUUID()}.${extension}`,
      contentType: file.contentType,
    });
    try {
      const updated = await this.events.update(projectId, id, { img: saved.url });
      if (!updated) throw CustomError.notFound("Evento no encontrado");
      await this.storage.deleteByUrl(event.values.img);
      return updated;
    } catch (error) {
      await this.storage.deleteByUrl(saved.url);
      throw error;
    }
  }

  async deleteImage(projectId: string, id: string) {
    const event = await this.getById(projectId, id);
    const updated = await this.events.update(projectId, id, { img: "" });
    if (!updated) throw CustomError.notFound("Evento no encontrado");
    await this.storage.deleteByUrl(event.values.img);
    return updated;
  }
}
