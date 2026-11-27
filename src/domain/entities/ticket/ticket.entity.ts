import { auditFieldsFromObject, type AuditFields } from "../shared/audit.entity";
import { ticketAccessStatus, type TicketAccessStatus, type TicketSaleStatus } from "../../policies/ticket/ticket-policy";

export type TicketHistoryItem = {
  id: string;
  tipo: string;
  detalle: Record<string, unknown>;
  terminalId: string | null;
  actor: { id: string | null; nombre: string };
  creadoEn: number;
};

export type TicketEntityOptions = AuditFields & {
  id: string;
  projectId: string;
  eventId: string;
  eventoNombre: string;
  folio: string;
  estadoVenta: TicketSaleStatus;
  estadoAcceso: TicketAccessStatus;
  titularNombre: string;
  titularCorreo: string;
  titularTelefono: string;
  usadoEn: number | null;
  canceladoEn: number | null;
  /** Delivery by email, apart from the sale: NO_ENVIADO, ENVIADO or ERROR (last attempt failed). */
  estadoEnvio: "NO_ENVIADO" | "ENVIADO" | "ERROR";
  enviadoEn: number | null;
  enviadoA: string;
  historial?: TicketHistoryItem[];
};

const instant = (value: unknown) => value instanceof Date ? value.getTime() : null;
const dateText = (value: unknown) => value instanceof Date
  ? value.toISOString().slice(0, 10)
  : String(value ?? "").slice(0, 10);

export class TicketEntity {
  constructor(public readonly values: TicketEntityOptions) {}
  get id() { return this.values.id; }

  toJSON() {
    const { projectId: _projectId, ...contract } = this.values;
    return contract;
  }

  static fromObject(object: Record<string, unknown>): TicketEntity {
    const event = object.event as Record<string, unknown>;
    const status = object.estadoVenta as TicketSaleStatus;
    return new TicketEntity({
      id: String(object.id),
      projectId: String(object.projectId),
      eventId: String(object.eventId),
      eventoNombre: String(event.nombre),
      folio: String(object.folio),
      estadoVenta: status,
      estadoAcceso: ticketAccessStatus({
        estadoVenta: status,
        usadoEn: instant(object.usadoEn),
        fechaInicio: dateText(event.fechaInicio),
        fechaFin: dateText(event.fechaFin),
        horaInicio: String(event.horaInicio),
        horaFin: String(event.horaFin),
        zonaHoraria: String(event.zonaHoraria),
        eventoActivo: event.estado !== false,
      }),
      titularNombre: String(object.titularNombre ?? ""),
      titularCorreo: String(object.titularCorreo ?? ""),
      titularTelefono: String(object.titularTelefono ?? ""),
      usadoEn: instant(object.usadoEn),
      canceladoEn: instant(object.canceladoEn),
      estadoEnvio: object.estadoEnvio === "ENVIADO" || object.estadoEnvio === "ERROR" ? object.estadoEnvio : "NO_ENVIADO",
      enviadoEn: instant(object.enviadoEn),
      enviadoA: String(object.enviadoA ?? ""),
      ...(Array.isArray(object.history) ? { historial: object.history as TicketHistoryItem[] } : {}),
      ...auditFieldsFromObject(object),
    });
  }
}
