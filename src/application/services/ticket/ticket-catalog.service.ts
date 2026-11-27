import type { OfflineScanOutcome } from "../../../domain/datasources/ticket/ticket-catalog.datasource";
import type { OfflineScansDto } from "../../../domain/dtos/ticket/offline-scans.dto";
import {
  catalogStatus,
  changesSince,
  decodeCursor,
  encodeCursor,
  eventWindow,
  isInCatalogWindow,
  type CatalogStatus,
} from "../../../domain/policies/ticket/ticket-catalog-policy";
import type { TicketCatalogRepository } from "../../../domain/repository/ticket/ticket-catalog.repository";

const DAY_MS = 24 * 60 * 60 * 1000;
const dateText = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export type CatalogAnswer = {
  /** completo: replace the local catalog; cambios: apply these rows on top of it. */
  modo: "completo" | "cambios";
  cursor: string;
  generadoEn: number;
  eventos: Array<{ id: string; nombre: string; inicio: string; fin: string }>;
  boletos: Array<{
    id: string;
    eventoId: string;
    folio: string;
    titularNombre: string;
    hash: string | null;
    estado: CatalogStatus;
  }>;
};

/**
 * What lets a gateway keep validating without internet: the catalog of the events that are on
 * (or about to start) and the upload of the scans it accepted while offline.
 */
export class TicketCatalogService {
  constructor(private readonly catalogs: TicketCatalogRepository) {}

  async catalog(projectId: string, cursor: unknown, nowMs = Date.now()): Promise<CatalogAnswer> {
    // Dates by a two-day margin (time zones), then the exact window by instants.
    const candidates = await this.catalogs.catalogEvents(projectId, dateText(nowMs - 2 * DAY_MS), dateText(nowMs + 2 * DAY_MS));
    const events = candidates
      .map((event) => ({ ...event, window: eventWindow(event) }))
      .filter((event) => isInCatalogWindow(event.window, nowMs));
    const eventIds = events.map((event) => event.id);
    const since = changesSince(decodeCursor(cursor), eventIds);
    const tickets = await this.catalogs.catalogTickets(projectId, eventIds, since === null ? null : new Date(since));

    return {
      modo: since === null ? "completo" : "cambios",
      cursor: encodeCursor({ t: nowMs, e: eventIds }),
      generadoEn: nowMs,
      eventos: events.map((event) => ({
        id: event.id,
        nombre: event.nombre,
        inicio: new Date(event.window.inicio).toISOString(),
        fin: new Date(event.window.fin).toISOString(),
      })),
      boletos: tickets.map((ticket) => ({
        id: ticket.id,
        eventoId: ticket.eventId,
        folio: ticket.folio,
        titularNombre: ticket.titularNombre,
        hash: ticket.hash,
        estado: ticket.hash ? catalogStatus(ticket) : "NO_VALIDO",
      })),
    };
  }

  /** In scan order, so the first gate to let someone in is the one that counts. */
  async offlineScans(projectId: string, gatewayId: string, dto: OfflineScansDto): Promise<{ resultados: OfflineScanOutcome[] }> {
    const ordered = [...dto.scans].sort((a, b) => a.scannedAt.getTime() - b.scannedAt.getTime());
    const resultados: OfflineScanOutcome[] = [];
    for (const scan of ordered) {
      resultados.push(await this.catalogs.applyOfflineScan(projectId, gatewayId, scan));
    }
    return { resultados };
  }
}
