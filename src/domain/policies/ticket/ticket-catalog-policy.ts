import type { TicketSaleStatus } from "./ticket-policy";

/**
 * The offline catalog a gateway downloads so it can keep validating without internet. It only
 * carries the SHA-256 of each QR (never the QR itself): a stolen SD card cannot mint tickets.
 */

const HOUR_MS = 60 * 60 * 1000;
/** Events that are on now or start within this time travel in the catalog. */
export const CATALOG_LOOKAHEAD_MS = 24 * HOUR_MS;
/** Changes since the cursor are re-sent with this overlap, so a commit in flight is never missed. */
export const CURSOR_OVERLAP_MS = 5_000;

/** UTC offset of a time zone at an instant (ms to add to UTC to get the local wall clock). */
const zoneOffsetMs = (utcMs: number, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const wallClockAsUtc = Date.UTC(
    value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"),
  );
  return wallClockAsUtc - Math.floor(utcMs / 1000) * 1000;
};

/** The instant a local date and time (YYYY-MM-DD, HH:mm) happens in a time zone. */
export const zonedInstant = (date: string, time: string, timeZone: string): number => {
  const asUtc = Date.parse(`${date}T${time}:00Z`);
  const firstGuess = asUtc - zoneOffsetMs(asUtc, timeZone);
  // Around a DST change the offset at the guess may differ from the offset at the answer.
  return asUtc - zoneOffsetMs(firstGuess, timeZone);
};

export type ZonedEventSchedule = {
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  zonaHoraria: string;
};

/** When an event opens and closes, as instants. The closing minute counts as open (HH:mm:59.999). */
export const eventWindow = (event: ZonedEventSchedule): { inicio: number; fin: number } => ({
  inicio: zonedInstant(event.fechaInicio, event.horaInicio, event.zonaHoraria),
  fin: zonedInstant(event.fechaFin, event.horaFin, event.zonaHoraria) + 60_000 - 1,
});

/** An event goes in the catalog while it is on or about to start. */
export const isInCatalogWindow = (window: { inicio: number; fin: number }, nowMs: number): boolean =>
  window.fin >= nowMs && window.inicio <= nowMs + CATALOG_LOOKAHEAD_MS;

/** VALIDO: lets you in; USADO: already got in; NO_VALIDO: cancelled, not sold or its QR was reissued. */
export type CatalogStatus = "VALIDO" | "USADO" | "NO_VALIDO";

export const catalogStatus = (ticket: { estadoVenta: TicketSaleStatus; usadoEn: Date | number | null }): CatalogStatus => {
  if (ticket.estadoVenta !== "VENDIDO") return "NO_VALIDO";
  return ticket.usadoEn === null ? "VALIDO" : "USADO";
};

/**
 * Opaque cursor: when the last answer was built and which events it covered. A new event in
 * the window needs a full download (its tickets were never sent); otherwise only changes.
 */
export type CatalogCursor = { t: number; e: string[] };

export const encodeCursor = (cursor: CatalogCursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString("base64url");

export const decodeCursor = (value: unknown): CatalogCursor | null => {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const { t, e } = parsed as Record<string, unknown>;
    if (typeof t !== "number" || !Array.isArray(e) || !e.every((id) => typeof id === "string")) return null;
    return { t, e: e as string[] };
  } catch {
    return null;
  }
};

/** Only changes when the gateway already has every event of the window. */
export const changesSince = (cursor: CatalogCursor | null, eventIds: string[]): number | null => {
  if (!cursor) return null;
  const known = new Set(cursor.e);
  return eventIds.every((id) => known.has(id)) ? cursor.t - CURSOR_OVERLAP_MS : null;
};

/** What happens with a scan the gateway accepted while it had no internet. */
export type OfflineScanResult = "ACEPTADO" | "DUPLICADO" | "NO_VALIDO";

/**
 * The person already went in. A ticket still valid is consumed with the real scan time; one
 * used at another gate (or before) is a duplicate; one cancelled or reissued meanwhile is
 * recorded as not valid. Repeating the same scan is accepted again without new history.
 */
export const offlineScanResult = (ticket: {
  estadoVenta: TicketSaleStatus;
  usadoEn: number | null;
  credentialRevoked: boolean;
  scannedAt: number;
}): { result: OfflineScanResult; alreadyRecorded: boolean } => {
  if (ticket.usadoEn !== null) {
    return ticket.usadoEn === ticket.scannedAt
      ? { result: "ACEPTADO", alreadyRecorded: true }
      : { result: "DUPLICADO", alreadyRecorded: false };
  }
  if (ticket.estadoVenta !== "VENDIDO" || ticket.credentialRevoked) return { result: "NO_VALIDO", alreadyRecorded: false };
  return { result: "ACEPTADO", alreadyRecorded: false };
};
