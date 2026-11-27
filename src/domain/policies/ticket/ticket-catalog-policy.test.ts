import { describe, expect, it } from "vitest";
import {
  catalogStatus,
  changesSince,
  CURSOR_OVERLAP_MS,
  decodeCursor,
  encodeCursor,
  eventWindow,
  isInCatalogWindow,
  offlineScanResult,
  zonedInstant,
} from "./ticket-catalog-policy";

describe("ticket catalog policy", () => {
  it("turns local event times into instants", () => {
    // Mexico City has no DST: always UTC-6.
    expect(new Date(zonedInstant("2026-11-27", "20:00", "America/Mexico_City")).toISOString())
      .toBe("2026-11-28T02:00:00.000Z");
    // New York in summer is UTC-4, in winter UTC-5.
    expect(new Date(zonedInstant("2026-07-01", "12:00", "America/New_York")).toISOString())
      .toBe("2026-07-01T16:00:00.000Z");
    expect(new Date(zonedInstant("2026-12-01", "12:00", "America/New_York")).toISOString())
      .toBe("2026-12-01T17:00:00.000Z");

    const window = eventWindow({
      fechaInicio: "2026-11-27", fechaFin: "2026-11-27", horaInicio: "10:00", horaFin: "20:00",
      zonaHoraria: "America/Mexico_City",
    });
    expect(new Date(window.fin).toISOString()).toBe("2026-11-28T02:00:59.999Z");
  });

  it("carries events that are on or start within a day", () => {
    const now = Date.parse("2026-11-27T12:00:00Z");
    const hour = 3_600_000;
    expect(isInCatalogWindow({ inicio: now - hour, fin: now + hour }, now)).toBe(true);
    expect(isInCatalogWindow({ inicio: now + 23 * hour, fin: now + 30 * hour }, now)).toBe(true);
    expect(isInCatalogWindow({ inicio: now + 25 * hour, fin: now + 30 * hour }, now)).toBe(false);
    expect(isInCatalogWindow({ inicio: now - 5 * hour, fin: now - hour }, now)).toBe(false);
  });

  it("maps tickets to what the gateway needs", () => {
    expect(catalogStatus({ estadoVenta: "VENDIDO", usadoEn: null })).toBe("VALIDO");
    expect(catalogStatus({ estadoVenta: "VENDIDO", usadoEn: 1 })).toBe("USADO");
    expect(catalogStatus({ estadoVenta: "CANCELADO", usadoEn: null })).toBe("NO_VALIDO");
    expect(catalogStatus({ estadoVenta: "RESERVADO", usadoEn: null })).toBe("NO_VALIDO");
  });

  it("sends only changes while the gateway already has every event", () => {
    const cursor = decodeCursor(encodeCursor({ t: 10_000, e: ["a", "b"] }));
    expect(cursor).toEqual({ t: 10_000, e: ["a", "b"] });
    expect(changesSince(cursor, ["a"])).toBe(10_000 - CURSOR_OVERLAP_MS);
    expect(changesSince(cursor, ["a", "c"])).toBeNull();
    expect(changesSince(null, ["a"])).toBeNull();
    expect(decodeCursor("not-a-cursor")).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });

  it("records offline scans honestly and idempotently", () => {
    const sold = { estadoVenta: "VENDIDO" as const, usadoEn: null, credentialRevoked: false, scannedAt: 500 };
    expect(offlineScanResult(sold)).toEqual({ result: "ACEPTADO", alreadyRecorded: false });
    expect(offlineScanResult({ ...sold, usadoEn: 500 })).toEqual({ result: "ACEPTADO", alreadyRecorded: true });
    expect(offlineScanResult({ ...sold, usadoEn: 400 })).toEqual({ result: "DUPLICADO", alreadyRecorded: false });
    expect(offlineScanResult({ ...sold, estadoVenta: "CANCELADO" }).result).toBe("NO_VALIDO");
    expect(offlineScanResult({ ...sold, credentialRevoked: true }).result).toBe("NO_VALIDO");
  });
});
