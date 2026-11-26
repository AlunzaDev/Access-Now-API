import { CustomError } from "../../errors/custom.error";
import { auditFieldsFromObject, type AuditFields } from "../shared/audit.entity";

export interface ProjectEntityOptions extends AuditFields {
  id: string;
  nombre: string;
  clave: string;
  descripcion: string;
  direccion: string;
  ciudad: string;
  img: string;
  latitud: number | null;
  longitud: number | null;
  estado: boolean;
}

/** A venue or client: it owns its events and its SCAT scanners. Fields are the API contract. */
export class ProjectEntity {
  public id: string;
  public nombre: string;
  public clave: string;
  public descripcion: string;
  public direccion: string;
  public ciudad: string;
  public img: string;
  public latitud: number | null;
  public longitud: number | null;
  public estado: boolean;
  public creadoPor: AuditFields["creadoPor"];
  public creadoEn: number;
  public actualizadoPor: AuditFields["actualizadoPor"];
  public actualizadoEn: number;

  constructor(options: ProjectEntityOptions) {
    this.id = options.id;
    this.nombre = options.nombre;
    this.clave = options.clave;
    this.descripcion = options.descripcion;
    this.direccion = options.direccion;
    this.ciudad = options.ciudad;
    this.img = options.img;
    this.latitud = options.latitud;
    this.longitud = options.longitud;
    this.estado = options.estado;
    this.creadoPor = options.creadoPor;
    this.creadoEn = options.creadoEn;
    this.actualizadoPor = options.actualizadoPor;
    this.actualizadoEn = options.actualizadoEn;
  }

  static fromObject(object: Record<string, unknown>): ProjectEntity {
    const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    if (!object.id) throw CustomError.badRequest("Missing project id");
    if (!text(object.nombre)) throw CustomError.badRequest("Missing project nombre");
    if (!text(object.clave)) throw CustomError.badRequest("Missing project clave");

    return new ProjectEntity({
      id: String(object.id),
      nombre: text(object.nombre),
      clave: normalizeClave(object.clave),
      descripcion: text(object.descripcion),
      direccion: text(object.direccion),
      ciudad: text(object.ciudad),
      img: text(object.img),
      latitud: typeof object.latitud === "number" ? object.latitud : null,
      longitud: typeof object.longitud === "number" ? object.longitud : null,
      estado: object.estado !== false,
      ...auditFieldsFromObject(object),
    });
  }
}

/** Claves are uppercase with dashes: "Estadio gdl" → "ESTADIO-GDL". */
export const normalizeClave = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** What the dashboard needs to show a project in the selector (login, renew). */
export type ProjectSummary = Pick<ProjectEntity, "id" | "nombre" | "clave" | "estado">;

export const toProjectSummary = ({ id, nombre, clave, estado }: ProjectEntity): ProjectSummary => ({
  id,
  nombre,
  clave,
  estado,
});
