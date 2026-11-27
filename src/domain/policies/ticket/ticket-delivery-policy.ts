import { isValidEmail } from "../shared/email-format";
import type { TicketSaleStatus } from "./ticket-policy";

/** A cancelled or refunded ticket has no valid QR: no PDF for it. */
export const canPrintTicket = (estadoVenta: TicketSaleStatus): string | null =>
  estadoVenta === "CANCELADO" || estadoVenta === "REEMBOLSADO"
    ? "Un boleto anulado no tiene PDF"
    : null;

/** Only a sold ticket is emailed: an unsold one would not let anybody in. */
export const canEmailTicket = (estadoVenta: TicketSaleStatus): string | null => {
  const voided = canPrintTicket(estadoVenta);
  if (voided) return voided;
  return estadoVenta === "VENDIDO" ? null : "Solo se envía un boleto vendido";
};

/**
 * Where to send it: the address given, or the holder's. When the ticket had no address, the
 * one given becomes the holder's (so the next send needs nothing).
 */
export const deliveryAddress = (
  requested: string | undefined,
  holderEmail: string,
): { correo: string; saveAsHolder: boolean } | { error: string } => {
  const correo = (requested ?? "").trim().toLowerCase() || holderEmail.trim().toLowerCase();
  if (!correo) return { error: "El boleto no tiene correo: indica a cuál enviarlo" };
  if (!isValidEmail(correo)) return { error: "'correo' no tiene un formato válido" };
  return { correo, saveAsHolder: !holderEmail.trim() };
};

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const parts = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
};

/**
 * The schedule as people read it, in the event's own local time:
 * "Sábado 13 de marzo de 2026 · 20:00 a 23:00", or "13 al 15 de marzo de 2026 · 10:00 a 22:00".
 */
export const eventScheduleText = (event: {
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
}): string => {
  const start = parts(event.fechaInicio);
  const end = parts(event.fechaFin);
  const hours = `${event.horaInicio} a ${event.horaFin}`;
  if (event.fechaInicio === event.fechaFin) {
    return `${WEEKDAYS[start.weekday]} ${start.day} de ${MONTHS[start.month - 1]} de ${start.year} · ${hours}`;
  }
  const startText = start.year !== end.year
    ? `${start.day} de ${MONTHS[start.month - 1]} de ${start.year}`
    : start.month !== end.month
      ? `${start.day} de ${MONTHS[start.month - 1]}`
      : `${start.day}`;
  return `${startText} al ${end.day} de ${MONTHS[end.month - 1]} de ${end.year} · ${hours}`;
};

/** A map link when the project has a location. */
export const mapUrl = (latitud: number | null, longitud: number | null): string | null =>
  latitud === null || longitud === null ? null : `https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`;
