import type { TicketSaleStatus } from "../../policies/ticket/ticket-policy";
import type { OfflineScanResult } from "../../policies/ticket/ticket-catalog-policy";

/** An active event that may enter a gateway's offline catalog. */
export type CatalogEventRow = {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  zonaHoraria: string;
};

/** A ticket as the catalog needs it; `hash` is its active QR's SHA-256 (null: no active QR). */
export type CatalogTicketRow = {
  id: string;
  eventId: string;
  folio: string;
  titularNombre: string;
  estadoVenta: TicketSaleStatus;
  usadoEn: Date | null;
  hash: string | null;
};

export type OfflineScan = { hash: string; scannedAt: Date; terminalMac?: string };
export type OfflineScanOutcome = { hash: string; resultado: OfflineScanResult | "DESCONOCIDO" };

export interface TicketCatalogDatasource {
  /** Active events of the project whose dates touch [fromDate, toDate] (YYYY-MM-DD). */
  catalogEvents(projectId: string, fromDate: string, toDate: string): Promise<CatalogEventRow[]>;
  /** Sold tickets of those events; with `since`, every ticket of them changed after it. */
  catalogTickets(projectId: string, eventIds: string[], since: Date | null): Promise<CatalogTicketRow[]>;
  /** Records a scan the gateway accepted without internet (idempotent). */
  applyOfflineScan(projectId: string, gatewayId: string, scan: OfflineScan): Promise<OfflineScanOutcome>;
}
