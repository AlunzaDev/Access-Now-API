import { UniqueConstraintError } from "./unique-constraint.error";

/**
 * Error with an HTTP status. Services throw it; api/middlewares/error-handler turns it into
 * the API error body `{ ok: false, message, statusCode, details }` (docs/contrato-api.md).
 */
export class CustomError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "CustomError";
  }

  static badRequest(message: string, details?: unknown) {
    return new CustomError(400, message, details);
  }

  static unauthorized(message: string, details?: unknown) {
    return new CustomError(401, message, details);
  }

  static forbidden(message: string, details?: unknown) {
    return new CustomError(403, message, details);
  }

  static notFound(message: string, details?: unknown) {
    return new CustomError(404, message, details);
  }

  static conflict(message: string, details?: unknown) {
    return new CustomError(409, message, details);
  }

  static tooManyRequests(message: string, details?: unknown) {
    return new CustomError(429, message, details);
  }

  /** A dependency (mail server, payment provider) cannot answer now; retrying later may work. */
  static serviceUnavailable(message: string, details?: unknown) {
    return new CustomError(503, message, details);
  }

  static internalServer(message: string, details?: unknown) {
    return new CustomError(500, message, details);
  }

  /** Domain-level translation of known errors; anything else becomes a generic 500. */
  static fromUnknown(error: unknown, fallbackMessage = "Ocurrió un error inesperado"): CustomError {
    if (error instanceof CustomError) return error;

    if (error instanceof UniqueConstraintError) {
      const fieldLabel = error.fields.join(", ") || "el valor";
      return CustomError.conflict(`Ya existe un registro con ${fieldLabel}`, { fields: error.fields });
    }

    const name = (error as { name?: unknown } | null)?.name;
    if (name === "TokenExpiredError") return CustomError.unauthorized("El token ha expirado");
    if (name === "JsonWebTokenError") return CustomError.unauthorized("El token no es válido");

    return CustomError.internalServer(fallbackMessage);
  }
}
