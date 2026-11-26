import { unknownFields } from "../user/user-fields";
import { PROJECT_FIELDS, readProject } from "./project-fields";

export class CreateProjectDto {
  private constructor(
    public readonly nombre: string,
    public readonly clave: string,
    public readonly descripcion: string,
    public readonly direccion: string,
    public readonly ciudad: string,
    public readonly estado: boolean,
    public readonly latitud: number | null,
    public readonly longitud: number | null,
  ) {}

  static create(body: Record<string, unknown>): [string?, CreateProjectDto?] {
    const extra = unknownFields(body, PROJECT_FIELDS);
    if (extra.length > 0) return [`Campos no permitidos: ${extra.join(", ")}`];

    const [error, values] = readProject(body, true);
    if (error) return [error];
    return [
      undefined,
      new CreateProjectDto(
        values!.nombre!,
        values!.clave!,
        values!.descripcion ?? "",
        values!.direccion ?? "",
        values!.ciudad ?? "",
        values!.estado ?? true,
        values!.latitud ?? null,
        values!.longitud ?? null,
      ),
    ];
  }
}
