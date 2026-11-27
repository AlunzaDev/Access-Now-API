import { describe, expect, it } from "vitest";
import { canRaiseAlert, fingerprintMatches, isSourceConflict } from "./gateway-access-policy";

describe("gateway access policy", () => {
  it("accepts only the enrolled fingerprint", () => {
    expect(fingerprintMatches("pi-serial-123", "pi-serial-123")).toBe(true);
    expect(fingerprintMatches("pi-serial-123", "pi-serial-124")).toBe(false);
    expect(fingerprintMatches("pi-serial-123", "")).toBe(false);
    expect(fingerprintMatches(null, "pi-serial-123")).toBe(false);
  });

  it("flags another address only while the gateway was still online", () => {
    expect(isSourceConflict("1.1.1.1", 1_000, "2.2.2.2", 1_500, 1_000)).toBe(true);
    expect(isSourceConflict("1.1.1.1", 1_000, "2.2.2.2", 5_000, 1_000)).toBe(false);
    expect(isSourceConflict("1.1.1.1", 1_000, "1.1.1.1", 1_500, 1_000)).toBe(false);
    expect(isSourceConflict(null, null, "2.2.2.2", 1_500, 1_000)).toBe(false);
  });

  it("raises one alert per cooldown", () => {
    expect(canRaiseAlert(null, 10, 100)).toBe(true);
    expect(canRaiseAlert(0, 50, 100)).toBe(false);
    expect(canRaiseAlert(0, 100, 100)).toBe(true);
  });
});
