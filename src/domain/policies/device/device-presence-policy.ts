import type { EnrollmentStatus } from "../../entities/device/device-status.entity";

export const ENROLLMENT_WARNING_MS = 7 * 24 * 60 * 60 * 1000;

/** Online only with a heartbeat within the threshold; never online without one. */
export const isOnline = (lastSeenMs: number | null, nowMs: number, thresholdMs: number): boolean =>
  lastSeenMs !== null && nowMs - lastSeenMs <= thresholdMs;

/** The enrollment of a gateway at `nowMs`. null when it never enrolled. */
export const enrollmentStatus = (
  enrolledAtMs: number | null,
  expiresAtMs: number | null,
  nowMs: number,
  warningMs = ENROLLMENT_WARNING_MS,
): EnrollmentStatus | null => {
  if (enrolledAtMs === null) return null;
  const vencido = expiresAtMs !== null && expiresAtMs <= nowMs;
  return {
    activo: !vencido,
    enroladoEn: enrolledAtMs,
    expiraEn: expiresAtMs,
    vencido,
    vencePronto: !vencido && expiresAtMs !== null && expiresAtMs - nowMs <= warningMs,
  };
};
