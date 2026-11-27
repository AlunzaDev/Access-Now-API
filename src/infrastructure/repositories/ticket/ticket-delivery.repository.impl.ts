import type { TicketDeliveryDatasource } from "../../../domain/datasources/ticket/ticket-delivery.datasource";
import type { TicketDeliveryRepository } from "../../../domain/repository/ticket/ticket-delivery.repository";

export class TicketDeliveryRepositoryImpl implements TicketDeliveryRepository {
  constructor(private readonly datasource: TicketDeliveryDatasource) {}

  findDocuments: TicketDeliveryRepository["findDocuments"] = (...args) => this.datasource.findDocuments(...args);
  recordQrViewed: TicketDeliveryRepository["recordQrViewed"] = (...args) => this.datasource.recordQrViewed(...args);
  recordDelivery: TicketDeliveryRepository["recordDelivery"] = (...args) => this.datasource.recordDelivery(...args);
  listDeliveries: TicketDeliveryRepository["listDeliveries"] = (...args) => this.datasource.listDeliveries(...args);
}
