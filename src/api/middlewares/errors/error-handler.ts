import type { NextFunction, Request, Response } from "express";
import { logger } from "../../../config/logger";
import { CustomError } from "../../../domain/errors/custom.error";

const INTERNAL_ERROR_MESSAGE = "Ocurrió un error inesperado";

/** Body-parser errors (malformed JSON, body too big) carry an HTTP status and a `type`. */
const bodyParserError = (error: unknown): CustomError | null => {
  const candidate = error as { status?: unknown; type?: unknown } | null;
  if (candidate?.type === "entity.parse.failed") return CustomError.badRequest("El cuerpo no es un JSON válido");
  if (candidate?.type === "entity.too.large") return new CustomError(413, "El cuerpo es demasiado grande");
  return null;
};

/**
 * The single shape of every API error (docs/contrato-api.md):
 * `{ ok: false, message, statusCode, details }`. `message` is always safe to show.
 */
export class ErrorService {
  static toApiError(error: unknown): CustomError {
    if (error instanceof CustomError) return error;
    return bodyParserError(error) ?? CustomError.fromUnknown(error, INTERNAL_ERROR_MESSAGE);
  }

  static send(res: Response, statusCode: number, message: string, details?: unknown) {
    return res.status(statusCode).json({ ok: false, message, statusCode, details: details ?? null });
  }

  static handleApiError(error: unknown, res: Response) {
    const apiError = ErrorService.toApiError(error);
    if (apiError.statusCode >= 500) logger.error("Error no controlado", error);
    return ErrorService.send(res, apiError.statusCode, apiError.message, apiError.details);
  }

  /** Last route: any `/api/*` path that does not exist. */
  static notFound = (_req: Request, res: Response) => ErrorService.send(res, 404, "Ruta no encontrada");

  /** Express error middleware (errors thrown before a controller, e.g. bad JSON). */
  static middleware = (error: unknown, _req: Request, res: Response, _next: NextFunction) =>
    ErrorService.handleApiError(error, res);
}
