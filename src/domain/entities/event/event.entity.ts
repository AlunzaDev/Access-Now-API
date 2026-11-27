import { CustomError } from "../../errors/custom.error";
import { auditFieldsFromObject, type AuditFields } from "../shared/audit.entity";

export type EventEntityOptions = AuditFields & {
  id: string;
  projectId: string;
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

const dateText = (value: unknown) => value instanceof Date
  ? value.toISOString().slice(0, 10)
  : String(value ?? "").slice(0, 10);

export class EventEntity {
  constructor(public readonly values: EventEntityOptions) {}

  get id() { return this.values.id; }
  get projectId() { return this.values.projectId; }

  toJSON() {
    const { projectId: _projectId, ...contract } = this.values;
    return contract;
  }

  static fromObject(object: Record<string, unknown>): EventEntity {
    if (!object.id) throw CustomError.badRequest("Missing event id");
    return new EventEntity({
      id: String(object.id),
      projectId: String(object.projectId),
      nombre: String(object.nombre),
      descripcion: String(object.descripcion ?? ""),
      img: String(object.img ?? ""),
      fechaInicio: dateText(object.fechaInicio),
      fechaFin: dateText(object.fechaFin),
      horaInicio: String(object.horaInicio),
      horaFin: String(object.horaFin),
      capacidad: typeof object.capacidad === "number" ? object.capacidad : null,
      zonaHoraria: String(object.zonaHoraria ?? "America/Mexico_City"),
      estado: object.estado !== false,
      ...auditFieldsFromObject(object),
    });
  }
}
