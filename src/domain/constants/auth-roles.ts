export const AUTH_ROLES = {
  /** Can do everything, including managing other super administrators. */
  SUPER: "SUPER_ROLE",
  /** Can open the sections of their permission profile. */
  ADMIN: "ADMIN_ROLE",
} as const;

export const AUTH_ROLE_VALUES = Object.values(AUTH_ROLES);

export type UsuarioRol = (typeof AUTH_ROLES)[keyof typeof AUTH_ROLES];

export const isUsuarioRol = (value: unknown): value is UsuarioRol =>
  typeof value === "string" && AUTH_ROLE_VALUES.includes(value as UsuarioRol);
