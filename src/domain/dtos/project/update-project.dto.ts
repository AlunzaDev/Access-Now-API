import { unknownFields } from "../user/user-fields";
import { PROJECT_FIELDS, readProject, type ProjectValues } from "./project-fields";

export class UpdateProjectDto {
  private constructor(public readonly values: ProjectValues) {}

  static create(body: Record<string, unknown>): [string?, UpdateProjectDto?] {
    const extra = unknownFields(body, PROJECT_FIELDS);
    if (extra.length > 0) return [`Campos no permitidos: ${extra.join(", ")}`];

    const [error, values] = readProject(body, false);
    if (error) return [error];
    if (Object.keys(values!).length === 0) return ["No hay campos para actualizar"];
    return [undefined, new UpdateProjectDto(values!)];
  }
}
