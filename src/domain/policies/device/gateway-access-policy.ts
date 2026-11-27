import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The fingerprint the gateway sends must be the one it enrolled with. A copied token alone is
 * not enough: the copy also needs the fingerprint (SCAT derives it from the Raspberry's
 * hardware, so a cloned SD card on another board sends a different one). Compared in constant
 * time so the answer time does not leak how much of it matched.
 */
export const fingerprintMatches = (enrolled: string | null, sent: string): boolean => {
  if (!enrolled || !sent) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(enrolled), digest(sent));
};

/**
 * The same gateway reporting from another address while it was still online: either the
 * network changed or the token is being used from two places at once. Either way it is worth
 * an alert in the history.
 */
export const isSourceConflict = (
  previousIp: string | null,
  previousSeenMs: number | null,
  ip: string,
  nowMs: number,
  windowMs: number,
): boolean =>
  previousIp !== null && previousSeenMs !== null && previousIp !== ip && nowMs - previousSeenMs < windowMs;

/** One alert per cooldown: a clone reporting every minute must not flood the history. */
export const canRaiseAlert = (lastAlertMs: number | null, nowMs: number, cooldownMs: number): boolean =>
  lastAlertMs === null || nowMs - lastAlertMs >= cooldownMs;
