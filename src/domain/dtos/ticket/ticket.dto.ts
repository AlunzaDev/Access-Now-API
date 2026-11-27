import { isValidEmail } from "../../policies/shared/email-format";
import { TICKET_SALE_STATUSES, type TicketSaleStatus } from "../../policies/ticket/ticket-policy";

export type TicketValues = {
  titularNombre: string;
  titularCorreo: string;
  titularTelefono: string;
  estadoVenta: TicketSaleStatus;
};

const fields = ["eventoId", "titularNombre", "titularCorreo", "titularTelefono", "estadoVenta"];
const writableStatuses: TicketSaleStatus[] = ["DISPONIBLE", "RESERVADO", "VENDIDO"];
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

const parse = (body: Record<string, unknown>): [string?, Partial<TicketValues>?] => {
  const unknown = Object.keys(body).filter((key) => !fields.includes(key));
  if (unknown.length) return [`Campos no permitidos: ${unknown.join(", ")}`];
  if (body.titularCorreo !== undefined && text(body.titularCorreo) && !isValidEmail(text(body.titularCorreo))) {
    return ["'titularCorreo' no tiene un formato válido"];
  }
  if (body.estadoVenta !== undefined &&
      (!TICKET_SALE_STATUSES.includes(body.estadoVenta as TicketSaleStatus) ||
       !writableStatuses.includes(body.estadoVenta as TicketSaleStatus))) {
    return ["'estadoVenta' no es válido"];
  }
  const values: Partial<TicketValues> = {};
  if (body.titularNombre !== undefined) values.titularNombre = text(body.titularNombre);
  if (body.titularCorreo !== undefined) values.titularCorreo = text(body.titularCorreo).toLowerCase();
  if (body.titularTelefono !== undefined) values.titularTelefono = text(body.titularTelefono);
  if (body.estadoVenta !== undefined) values.estadoVenta = body.estadoVenta as TicketSaleStatus;
  return [undefined, values];
};

export class CreateTicketDto {
  private constructor(public readonly eventId: string, public readonly values: TicketValues) {}

  static create(body: Record<string, unknown>): [string?, CreateTicketDto?] {
    const [error, parsed] = parse(body);
    if (error) return [error];
    if (typeof body.eventoId !== "string" || !body.eventoId) return ["'eventoId' es requerido"];
    const hasHolder = Boolean(parsed?.titularNombre || parsed?.titularCorreo || parsed?.titularTelefono);
    return [undefined, new CreateTicketDto(body.eventoId, {
      titularNombre: "",
      titularCorreo: "",
      titularTelefono: "",
      estadoVenta: hasHolder ? "VENDIDO" : "DISPONIBLE",
      ...parsed,
    })];
  }
}

export class UpdateTicketDto {
  private constructor(public readonly values: Partial<TicketValues>) {}

  static create(body: Record<string, unknown>): [string?, UpdateTicketDto?] {
    if (!Object.keys(body).length) return ["Envía al menos un campo para actualizar"];
    if (body.eventoId !== undefined) return ["Campos no permitidos: eventoId"];
    const [error, values] = parse(body);
    return error ? [error] : [undefined, new UpdateTicketDto(values ?? {})];
  }
}

export class CreateTicketBatchDto {
  private constructor(public readonly eventId: string, public readonly cantidad: number) {}

  static create(body: Record<string, unknown>): [string?, CreateTicketBatchDto?] {
    const unknown = Object.keys(body).filter((key) => !["eventoId", "cantidad"].includes(key));
    if (unknown.length) return [`Campos no permitidos: ${unknown.join(", ")}`];
    if (!Number.isInteger(body.cantidad) || Number(body.cantidad) < 1 || Number(body.cantidad) > 1000) {
      return ["'cantidad' debe ser un entero entre 1 y 1000"];
    }
    if (typeof body.eventoId !== "string" || !body.eventoId) return ["'eventoId' es requerido"];
    return [undefined, new CreateTicketBatchDto(body.eventoId, Number(body.cantidad))];
  }
}
