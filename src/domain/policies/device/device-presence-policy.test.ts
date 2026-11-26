import { describe, expect, it } from "vitest";
import { enrollmentStatus, isOnline } from "./device-presence-policy";

const DAY = 24 * 60 * 60 * 1000;

describe("isOnline", () => {
  it("is online only within the threshold of the last heartbeat", () => {
    expect(isOnline(1_000, 60_000, 90_000)).toBe(true);
    expect(isOnline(1_000, 91_001, 90_000)).toBe(false);
    expect(isOnline(null, 1_000, 90_000)).toBe(false);
  });
});

describe("enrollmentStatus", () => {
  const now = 100 * DAY;

  it("is null for a gateway that never enrolled", () => {
    expect(enrollmentStatus(null, null, now)).toBeNull();
  });

  it("never expires without an expiry date", () => {
    expect(enrollmentStatus(now - DAY, null, now)).toMatchObject({ activo: true, vencido: false, vencePronto: false });
  });

  it("warns during the last 7 days and expires after", () => {
    expect(enrollmentStatus(now - DAY, now + 3 * DAY, now)).toMatchObject({ activo: true, vencePronto: true });
    expect(enrollmentStatus(now - DAY, now + 30 * DAY, now)).toMatchObject({ activo: true, vencePronto: false });
    expect(enrollmentStatus(now - 40 * DAY, now - DAY, now)).toMatchObject({ activo: false, vencido: true, vencePronto: false });
  });
});
