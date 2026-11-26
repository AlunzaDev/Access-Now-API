/** Dashboard sections a permission profile can open. Keep in sync with `enum UserModule`. */
export const USER_MODULES = [
  "users",
  "permissionProfiles",
  "projects",
  "events",
  "tickets",
  "scanners",
  "orders",
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
