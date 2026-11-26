import { describe, expect, it } from "vitest";
import { normalizeClave } from "./project.entity";

describe("normalizeClave", () => {
  it("uppercases, removes accents and joins words with dashes", () => {
    expect(normalizeClave(" Estadio  Jalisco ")).toBe("ESTADIO-JALISCO");
    expect(normalizeClave("Auditorio Telmex #2")).toBe("AUDITORIO-TELMEX-2");
    expect(normalizeClave("Plaza Ñuñoa")).toBe("PLAZA-NUNOA");
    expect(normalizeClave("--")).toBe("");
  });
});
