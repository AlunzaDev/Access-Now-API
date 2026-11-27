// Single list convention (docs/contrato-api.md): query `desde` (offset, base 0) and `limite`;
// response `{ items, total }`, where `total` counts every record that matches the filter.

export type Page<T> = { items: T[]; total: number };

export type PageRequest = { desde: number; limite: number };

export const MAX_PAGE_SIZE = 100;

const toInt = (value: unknown, fallback: number): number => {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

/** Invalid values are corrected, never rejected: negatives → 0, non numeric → default, too big → 100. */
export const parsePagination = (query: Record<string, unknown>, defaultLimit = 10): PageRequest => ({
  desde: Math.max(toInt(query.desde, 0), 0),
  limite: Math.min(Math.max(toInt(query.limite, defaultLimit), 1), MAX_PAGE_SIZE),
});

export const toPage = <T>(items: T[] | undefined | null, total?: number): Page<T> => {
  const list = Array.isArray(items) ? items : [];
  return { items: list, total: typeof total === "number" ? total : list.length };
};

/** Search text from `?buscar=`, trimmed; undefined when empty. */
export const parseSearch = (value: unknown): string | undefined => {
  const text = String(Array.isArray(value) ? value[0] : (value ?? "")).trim();
  return text ? text.slice(0, 100) : undefined;
};

export const parseActiveStatus = (value: unknown): boolean | undefined => {
  const text = String(Array.isArray(value) ? value[0] : (value ?? "")).trim().toLowerCase();
  if (text === "activo") return true;
  if (text === "inactivo") return false;
  return undefined;
};
