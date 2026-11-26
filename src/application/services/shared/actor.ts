import type { UserRole } from "../../../domain/constants";
import type { ProjectAccess } from "../../../domain/policies/project/project-access-policy";

/** Who is making the request, as services need it (built from the session in api/middlewares). */
export type Actor = { id: string; rol: UserRole; projectAccess: ProjectAccess };
