import { validateEventSchedule } from "../../policies/event/event-schedule-policy";

export type EventValues = {
  nombre: string;
  descripcion: string;
  img: string;
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  capacidad: number | null;
  zonaHoraria: string;
  estado: boolean;
};

const fields = [
  "nombre", "descripcion", "fechaInicio", "fechaFin", "horaInicio", "horaFin",
  "capacidad", "zonaHoraria", "estado",
];
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

const parse = (body: Record<string, unknown>, partial: boolean): [string?, Partial<EventValues>?] => {
  const unknown = Object.keys(body).filter((key) => !fields.includes(key));
  if (unknown.length) return [`Campos no permitidos: ${unknown.join(", ")}`];
  const required = ["nombre", "fechaInicio", "fechaFin", "horaInicio", "horaFin"];
  if (!partial) {
    const missing = required.filter((key) => !text(body[key]));
    if (missing.length) return [`Campos requeridos: ${missing.join(", ")}`];
  }
  if (body.nombre !== undefined && !text(body.nombre)) return ["'nombre' es requerido"];
  if (body.estado !== undefined && typeof body.estado !== "boolean") return ["'estado' debe ser booleano"];
  if (body.capacidad !== undefined && body.capacidad !== null &&
      (!Number.isInteger(body.capacidad) || Number(body.capacidad) <= 0)) {
    return ["'capacidad' debe ser un entero positivo o null"];
  }
  if (body.zonaHoraria !== undefined) {
    try { new Intl.DateTimeFormat("es-MX", { timeZone: text(body.zonaHoraria) }); }
    catch { return ["'zonaHoraria' no es una zona horaria válida"];
    }
  }
  const values: Partial<EventValues> = {};
  for (const key of ["nombre", "descripcion", "fechaInicio", "fechaFin", "horaInicio", "horaFin"] as const) {
    if (body[key] !== undefined) values[key] = text(body[key]);
  }
  if (body.estado !== undefined) values.estado = body.estado;
  if (body.capacidad !== undefined) values.capacidad = body.capacidad as number | null;
  if (body.zonaHoraria !== undefined) values.zonaHoraria = text(body.zonaHoraria);
  return [undefined, values];
};

export class CreateEventDto {
  private constructor(public readonly values: EventValues) {}

  static create(body: Record<string, unknown>): [string?, CreateEventDto?] {
    const [error, parsed] = parse(body, false);
    if (error) return [error];
    const values = {
      descripcion: "", img: "", capacidad: null, zonaHoraria: "America/Mexico_City", estado: true, ...parsed,
    } as EventValues;
    const scheduleError = validateEventSchedule(values);
    return scheduleError ? [scheduleError] : [undefined, new CreateEventDto(values)];
  }
}

export class UpdateEventDto {
  private constructor(public readonly values: Partial<EventValues>) {}

  static create(body: Record<string, unknown>): [string?, UpdateEventDto?] {
    if (!Object.keys(body).length) return ["Envía al menos un campo para actualizar"];
    const [error, values] = parse(body, true);
    return error ? [error] : [undefined, new UpdateEventDto(values ?? {})];
  }
}
