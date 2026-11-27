import type { EncryptedTicketToken } from "./ticket.datasource";
import type { TicketSaleStatus } from "../../policies/ticket/ticket-policy";

/** What a printable ticket needs from the ticket, its event and its project. */
export type TicketDocumentRow = {
  id: string;
  folio: string;
  titularNombre: string;
  titularCorreo: string;
  estadoVenta: TicketSaleStatus;
  creadoEn: Date;
  /** The active QR, encrypted; null for a ticket issued before QR recovery (reissue it). */
  credential: EncryptedTicketToken | null;
  event: { nombre: string; fechaInicio: string; fechaFin: string; horaInicio: string; horaFin: string };
  project: { nombre: string; direccion: string; ciudad: string; latitud: number | null; longitud: number | null };
};

export type TicketDeliveryRecord = {
  id: string;
  correo: string;
  estado: "ENVIADO" | "ERROR";
  error: string;
  creadoEn: number;
  actor: { id: string | null; nombre: string };
};

export type DeliveryAttempt = {
  ticketId: string;
  correo: string;
  ok: boolean;
  error: string;
  /** The ticket had no address: the one used becomes the holder's. */
  saveAsHolder: boolean;
};

export interface TicketDeliveryDatasource {
  /** The tickets of the project with those ids, in the order asked (missing ones are left out). */
  findDocuments(projectId: string, ids: string[]): Promise<TicketDocumentRow[]>;
  /** Opening the PDF shows the QR: it goes to each ticket's history. */
  recordQrViewed(ticketIds: string[]): Promise<void>;
  /** One email attempt: the delivery row, the ticket's delivery status and its history. */
  recordDelivery(attempt: DeliveryAttempt): Promise<void>;
  listDeliveries(ticketId: string, limit: number): Promise<TicketDeliveryRecord[]>;
}
