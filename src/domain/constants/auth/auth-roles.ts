/** Stored role codes (catalog values: they do not change without a data migration). */
export const AUTH_ROLES = {
  /** Can do everything, including managing other super administrators. */
  SUPER: "SUPER_ROLE",
  /** Can open the sections of their permission profile. */
  ADMIN: "ADMIN_ROLE",
} as const;

export const AUTH_ROLE_VALUES = Object.values(AUTH_ROLES);

export type UserRole = (typeof AUTH_ROLES)[keyof typeof AUTH_ROLES];

export const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" && AUTH_ROLE_VALUES.includes(value as UserRole);
