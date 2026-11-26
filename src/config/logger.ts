/* eslint-disable no-console -- the only place allowed to write to the console (docs/arquitectura.md). */

const stamp = () => new Date().toISOString();

export const logger = {
  info: (message: string, ...details: unknown[]) => console.log(`[${stamp()}] INFO ${message}`, ...details),
  warn: (message: string, ...details: unknown[]) => console.warn(`[${stamp()}] WARN ${message}`, ...details),
  error: (message: string, ...details: unknown[]) => console.error(`[${stamp()}] ERROR ${message}`, ...details),
};
