import type { EventDatasource } from "../../../domain/datasources/event/event.datasource";
import type { EventRepository } from "../../../domain/repository/event/event.repository";

export class EventRepositoryImpl implements EventRepository {
  constructor(private readonly datasource: EventDatasource) {}
  create: EventRepository["create"] = (...args) => this.datasource.create(...args);
  list: EventRepository["list"] = (...args) => this.datasource.list(...args);
  findById: EventRepository["findById"] = (...args) => this.datasource.findById(...args);
  update: EventRepository["update"] = (...args) => this.datasource.update(...args);
  delete: EventRepository["delete"] = (...args) => this.datasource.delete(...args);
}
