import { describe, expect, it } from "vitest";
import { validateProjectLocation } from "./project-location-policy";

describe("validateProjectLocation", () => {
  it("accepts a valid pair, boundaries, or no location", () => {
    expect(validateProjectLocation(19.4326, -99.1332)).toEqual({ latitud: 19.4326, longitud: -99.1332 });
    expect(validateProjectLocation(-90, 180)).toEqual({ latitud: -90, longitud: 180 });
    expect(validateProjectLocation(undefined, undefined)).toEqual({ latitud: undefined, longitud: undefined });
    expect(validateProjectLocation(null, null)).toEqual({ latitud: null, longitud: null });
  });

  it("rejects an incomplete pair", () => {
    expect(validateProjectLocation(10, undefined).error).toContain("deben enviarse juntas");
    expect(validateProjectLocation(null, 20).error).toContain("deben enviarse juntas");
  });

  it("rejects non-numeric and out-of-range coordinates", () => {
    expect(validateProjectLocation(91, 0).error).toContain("latitud");
    expect(validateProjectLocation(0, -181).error).toContain("longitud");
    expect(validateProjectLocation("19", -99).error).toContain("latitud");
  });
});
