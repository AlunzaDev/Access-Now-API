import { describe, expect, it } from "vitest";
import { canDeleteEvent, validateEventSchedule } from "./event-schedule-policy";

const valid = { fechaInicio: "2026-12-01", fechaFin: "2026-12-03", horaInicio: "10:00", horaFin: "22:00" };

describe("validateEventSchedule", () => {
  it("accepts one day and date ranges", () => {
    expect(validateEventSchedule(valid)).toBeNull();
    expect(validateEventSchedule({ ...valid, fechaFin: valid.fechaInicio, horaFin: "11:00" })).toBeNull();
  });

  it("rejects invalid ranges and formats", () => {
    expect(validateEventSchedule({ ...valid, fechaFin: "2026-11-30" })).toContain("fecha final");
    expect(validateEventSchedule({ ...valid, fechaFin: valid.fechaInicio, horaFin: "09:00" })).toContain("hora final");
    expect(validateEventSchedule({ ...valid, horaInicio: "25:00" })).toContain("HH:mm");
  });

  it("never deletes an event with tickets", () => {
    expect(canDeleteEvent(0)).toBeNull();
    expect(canDeleteEvent(3)).toContain("desactívalo");
  });
});
