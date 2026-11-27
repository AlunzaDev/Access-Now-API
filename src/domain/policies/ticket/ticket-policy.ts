export const TICKET_SALE_STATUSES = [
  "DISPONIBLE", "RESERVADO", "VENDIDO", "CANCELADO", "REEMBOLSADO",
] as const;

export type TicketSaleStatus = (typeof TICKET_SALE_STATUSES)[number];
export type TicketAccessStatus =
  | "EVENTO_INACTIVO"
  | "NO_VIGENTE"
  | "VIGENTE"
  | "USADO"
  | "NO_UTILIZADO"
  | "NO_VENDIDO"
  | "ANULADO";

/** The state a ticket is in, for the rules that decide what can still be done with it. */
export type TicketState = { estadoVenta: TicketSaleStatus; usadoEn: number | null };

const VOIDED: readonly TicketSaleStatus[] = ["CANCELADO", "REEMBOLSADO"];

/**
 * Sale-status changes allowed by hand (PATCH). A sold ticket is not "unsold": it is cancelled
 * (which revokes its QR and frees capacity) so the history stays truthful.
 */
const SALE_TRANSITIONS: Record<TicketSaleStatus, readonly TicketSaleStatus[]> = {
  DISPONIBLE: ["RESERVADO", "VENDIDO"],
  RESERVADO: ["DISPONIBLE", "VENDIDO"],
  VENDIDO: [],
  CANCELADO: [],
  REEMBOLSADO: [],
};

/** Why a ticket cannot be edited (holder or sale status), or null when it can. */
export const canChangeTicket = (current: TicketState, nextSaleStatus?: TicketSaleStatus): string | null => {
  if (VOIDED.includes(current.estadoVenta)) return "Un boleto anulado no puede modificarse";
  if (current.usadoEn !== null) return "Un boleto ya utilizado no puede modificarse";
  if (nextSaleStatus && nextSaleStatus !== current.estadoVenta
      && !SALE_TRANSITIONS[current.estadoVenta].includes(nextSaleStatus)) {
    return current.estadoVenta === "VENDIDO"
      ? "Un boleto vendido no vuelve a estar disponible: cancélalo"
      : `No se puede pasar un boleto de ${current.estadoVenta} a ${nextSaleStatus}`;
  }
  return null;
};

/** A used ticket was attended: cancelling it would free a place that was already taken. */
export const canCancelTicket = (current: TicketState): string | null => {
  if (VOIDED.includes(current.estadoVenta)) return "El boleto ya está cancelado";
  if (current.usadoEn !== null) return "Un boleto ya utilizado no puede cancelarse";
  return null;
};

/** Only an active event issues tickets. */
export const canIssueTickets = (eventActive: boolean): string | null =>
  eventActive ? null : "El evento está inactivo: actívalo para generar boletos";

export const validateTicketCapacity = (
  capacity: number | null,
  activeTickets: number,
  requested: number,
): string | null => {
  if (!Number.isInteger(requested) || requested < 1 || requested > 1000) {
    return "'cantidad' debe ser un entero entre 1 y 1000";
  }
  if (capacity !== null && activeTickets + requested > capacity) {
    return `La capacidad permite crear ${Math.max(0, capacity - activeTickets)} boleto(s) más`;
  }
  return null;
};

const localDateTime = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
};

export const ticketAccessStatus = (input: {
  estadoVenta: TicketSaleStatus;
  usadoEn: number | null;
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  zonaHoraria: string;
  /** A deactivated event lets nobody in, whatever its dates say. */
  eventoActivo: boolean;
  now?: Date;
}): TicketAccessStatus => {
  if (VOIDED.includes(input.estadoVenta)) return "ANULADO";
  if (input.usadoEn !== null) return "USADO";
  if (!input.eventoActivo) return "EVENTO_INACTIVO";
  if (input.estadoVenta !== "VENDIDO") return "NO_VENDIDO";
  const current = localDateTime(input.now ?? new Date(), input.zonaHoraria);
  const start = `${input.fechaInicio}T${input.horaInicio}`;
  const end = `${input.fechaFin}T${input.horaFin}`;
  if (current < start) return "NO_VIGENTE";
  if (current <= end) return "VIGENTE";
  return "NO_UTILIZADO";
};

const REJECTIONS: Record<Exclude<TicketAccessStatus, "VIGENTE">, string> = {
  USADO: "El boleto ya fue utilizado",
  ANULADO: "El boleto fue cancelado",
  EVENTO_INACTIVO: "El evento está inactivo",
  NO_VENDIDO: "El boleto no está vendido",
  NO_VIGENTE: "El evento todavía no empieza",
  NO_UTILIZADO: "El evento ya terminó",
};

/** What the terminal shows when a ticket does not get in; null when it does. */
export const accessRejection = (status: TicketAccessStatus): string | null =>
  status === "VIGENTE" ? null : REJECTIONS[status];

