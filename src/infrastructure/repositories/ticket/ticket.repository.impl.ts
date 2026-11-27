import type { TicketDatasource } from "../../../domain/datasources/ticket/ticket.datasource";
import type { TicketRepository } from "../../../domain/repository/ticket/ticket.repository";

export class TicketRepositoryImpl implements TicketRepository {
  constructor(private readonly datasource: TicketDatasource) {}
  create: TicketRepository["create"] = (...args) => this.datasource.create(...args);
  createBatch: TicketRepository["createBatch"] = (...args) => this.datasource.createBatch(...args);
  list: TicketRepository["list"] = (...args) => this.datasource.list(...args);
  findById: TicketRepository["findById"] = (...args) => this.datasource.findById(...args);
  update: TicketRepository["update"] = (...args) => this.datasource.update(...args);
  cancel: TicketRepository["cancel"] = (...args) => this.datasource.cancel(...args);
  reissue: TicketRepository["reissue"] = (...args) => this.datasource.reissue(...args);
  getActiveCredential: TicketRepository["getActiveCredential"] = (...args) =>
    this.datasource.getActiveCredential(...args);
  history: TicketRepository["history"] = (...args) => this.datasource.history(...args);
  countActive: TicketRepository["countActive"] = (...args) => this.datasource.countActive(...args);
  countByEvent: TicketRepository["countByEvent"] = (...args) => this.datasource.countByEvent(...args);
  validateAccess: TicketRepository["validateAccess"] = (...args) => this.datasource.validateAccess(...args);
}
