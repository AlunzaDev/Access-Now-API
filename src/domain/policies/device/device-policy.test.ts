import { describe, expect, it } from "vitest";
import {
  canDeleteGateway,
  isValidIpv4,
  normalizeMac,
  validateDeviceKind,
  validateTerminalGateway,
} from "./device-policy";

describe("device policy", () => {
  it("normalizes valid MAC addresses and rejects invalid ones", () => {
    expect(normalizeMac("aa-bb-cc-dd-ee-ff")).toBe("AA:BB:CC:DD:EE:FF");
    expect(normalizeMac("aabb.ccdd.eeff")).toBe("AA:BB:CC:DD:EE:FF");
    expect(normalizeMac("invalid")).toBeNull();
    expect(normalizeMac("")).toBeNull();
  });

  it("validates IPv4 addresses", () => {
    expect(isValidIpv4("192.168.1.20")).toBe(true);
    expect(isValidIpv4("256.1.1.1")).toBe(false);
    expect(isValidIpv4("01.1.1.1")).toBe(false);
  });

  it("requires terminal fields and separates fields by device type", () => {
    expect(validateDeviceKind("TERMINAL", {})).toContain("mac");
    expect(
      validateDeviceKind("TERMINAL", {
        mac: "AA:BB:CC:DD:EE:FF",
        gatewayId: "g",
        puertaId: "door-1",
        sentido: "ENTRADA",
      }),
    ).toBeUndefined();
    expect(validateDeviceKind("GATEWAY", { gatewayId: "g" })).toContain("gateway");
  });

  it("prevents deleting gateways with terminals", () => {
    expect(canDeleteGateway(1)).toContain("terminales");
    expect(canDeleteGateway(0)).toBeUndefined();
  });

  it("requires a gateway from the same project", () => {
    expect(validateTerminalGateway("a", { projectId: "a", tipo: "GATEWAY" })).toBeUndefined();
    expect(validateTerminalGateway("a", { projectId: "b", tipo: "GATEWAY" })).toContain("proyecto");
    expect(validateTerminalGateway("a", { projectId: "a", tipo: "TERMINAL" })).toContain("GATEWAY");
  });
});
