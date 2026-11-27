/**
 * What a permission profile can open. Keep in sync with `enum UserModule`. Most are dashboard
 * sections; `history` is a capability: seeing the immutable history of tickets and devices.
 */
export const USER_MODULES = [
  "users",
  "permissionProfiles",
  "projects",
  "events",
  "tickets",
  "scanners",
  "orders",
  "history",
] as const;

export type UserModuleAccess = (typeof USER_MODULES)[number];

const USER_MODULE_SET = new Set<string>(USER_MODULES);

export const isUserModule = (value: unknown): value is UserModuleAccess =>
  typeof value === "string" && USER_MODULE_SET.has(value);

/** Valid modules of `value`, without duplicates; anything else is dropped. */
export const normalizeUserModules = (value: unknown): UserModuleAccess[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(isUserModule)));
};

/** Entries of `value` that are not modules (to report them back). */
export const getInvalidUserModules = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => String(item ?? "").trim()).filter((item) => !USER_MODULE_SET.has(item))),
  );
};
