import type { Request } from "express";

/** A route parameter as a trimmed string (Express 5 types allow string[]). */
export const routeParam = (req: Request, name: string): string => {
  const value = req.params[name];
  return String(Array.isArray(value) ? value[0] : (value ?? "")).trim();
};

/** The query object with unknown values, for the DTO readers. */
export const queryOf = (req: Request): Record<string, unknown> => req.query as Record<string, unknown>;

/** The JSON body (an empty object when there is none). */
export const bodyOf = (req: Request): Record<string, unknown> =>
  req.body && typeof req.body === "object" && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};
