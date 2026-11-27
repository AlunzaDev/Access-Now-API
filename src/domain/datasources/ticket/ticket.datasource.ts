import type { Page, PageRequest } from "../../dtos/shared/pagination";
import type { TicketValues } from "../../dtos/ticket/ticket.dto";
import type { TicketEntity, TicketHistoryItem } from "../../entities/ticket/ticket.entity";
import type { TicketSaleStatus } from "../../policies/ticket/ticket-policy";

export type TicketListFilters = {
  projectId: string;
  eventId?: string;
  estadoVenta?: TicketSaleStatus;
  buscar?: string;
};

export type EncryptedTicketToken = { tokenCiphertext: string; tokenIv: string; tokenTag: string };
export type NewTicketSecret = EncryptedTicketToken & { token: string; tokenHash: string; folio: string };
export type TicketValidation = { ticket: TicketEntity; granted: boolean; message: string };

/** Where a scan happened: the gateway that asked and, if it says, the terminal (by MAC). */
export type ScanOrigin = { gatewayId: string; terminalMac?: string };

export interface TicketDatasource {
  create(projectId: string, eventId: string, values: TicketValues, secret: NewTicketSecret): Promise<TicketEntity>;
  createBatch(projectId: string, eventId: string, secrets: NewTicketSecret[]): Promise<TicketEntity[]>;
  list(filters: TicketListFilters, page: PageRequest): Promise<Page<TicketEntity>>;
  findById(projectId: string, id: string): Promise<TicketEntity | null>;
  update(projectId: string, id: string, values: Partial<TicketValues>): Promise<TicketEntity | null>;
  cancel(projectId: string, id: string): Promise<TicketEntity | null>;
  reissue(projectId: string, id: string, secret: EncryptedTicketToken & { tokenHash: string }): Promise<TicketEntity | null>;
  getActiveCredential(projectId: string, id: string): Promise<EncryptedTicketToken | null>;
  history(projectId: string, id: string): Promise<TicketHistoryItem[] | null>;
  countActive(projectId: string, eventId: string): Promise<number>;
  /** Every ticket of the event, cancelled ones included (they keep history). */
  countByEvent(projectId: string, eventId: string): Promise<number>;
  /** Consumes a valid ticket atomically; null when no active QR has that hash in the project. */
  validateAccess(projectId: string, tokenHash: string, origin: ScanOrigin): Promise<TicketValidation | null>;
}
