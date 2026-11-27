import type { EventValues } from "../../dtos/event/event.dto";
import type { Page, PageRequest } from "../../dtos/shared/pagination";
import type { EventEntity } from "../../entities/event/event.entity";

export type EventListFilters = { projectId: string; buscar?: string; estado?: boolean };

export interface EventDatasource {
  create(projectId: string, values: EventValues): Promise<EventEntity>;
  list(filters: EventListFilters, page: PageRequest): Promise<Page<EventEntity>>;
  findById(projectId: string, id: string): Promise<EventEntity | null>;
  update(projectId: string, id: string, values: Partial<EventValues>): Promise<EventEntity | null>;
  delete(projectId: string, id: string): Promise<EventEntity | null>;
}
