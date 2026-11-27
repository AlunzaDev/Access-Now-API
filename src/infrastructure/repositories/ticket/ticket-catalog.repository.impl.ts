import type { TicketCatalogDatasource } from "../../../domain/datasources/ticket/ticket-catalog.datasource";
import type { TicketCatalogRepository } from "../../../domain/repository/ticket/ticket-catalog.repository";

export class TicketCatalogRepositoryImpl implements TicketCatalogRepository {
  constructor(private readonly datasource: TicketCatalogDatasource) {}

  catalogEvents: TicketCatalogRepository["catalogEvents"] = (...args) => this.datasource.catalogEvents(...args);
  catalogTickets: TicketCatalogRepository["catalogTickets"] = (...args) => this.datasource.catalogTickets(...args);
  applyOfflineScan: TicketCatalogRepository["applyOfflineScan"] = (...args) =>
    this.datasource.applyOfflineScan(...args);
}
