import { describe, expect, it } from "vitest";
import { canEmailTicket, canPrintTicket, deliveryAddress, eventScheduleText, mapUrl } from "./ticket-delivery-policy";

describe("ticket delivery policy", () => {
  it("prints any ticket with a valid QR and emails only sold ones", () => {
    expect(canPrintTicket("DISPONIBLE")).toBeNull();
    expect(canPrintTicket("CANCELADO")).toContain("anulado");
    expect(canEmailTicket("VENDIDO")).toBeNull();
    expect(canEmailTicket("RESERVADO")).toContain("vendido");
    expect(canEmailTicket("REEMBOLSADO")).toContain("anulado");
  });

  it("uses the holder's address or asks for one, and keeps the one given", () => {
    expect(deliveryAddress(undefined, "ada@example.test")).toEqual({ correo: "ada@example.test", saveAsHolder: false });
    expect(deliveryAddress(" Otra@Example.test ", "ada@example.test")).toEqual({
      correo: "otra@example.test",
      saveAsHolder: false,
    });
    expect(deliveryAddress("nuevo@example.test", "")).toEqual({ correo: "nuevo@example.test", saveAsHolder: true });
    expect(deliveryAddress(undefined, "")).toEqual({ error: "El boleto no tiene correo: indica a cuál enviarlo" });
    expect(deliveryAddress("no-es-correo", "")).toHaveProperty("error");
  });

  it("writes the schedule as people read it", () => {
    const base = { horaInicio: "20:00", horaFin: "23:00" };
    expect(eventScheduleText({ ...base, fechaInicio: "2026-03-14", fechaFin: "2026-03-14" }))
      .toBe("Sábado 14 de marzo de 2026 · 20:00 a 23:00");
    expect(eventScheduleText({ ...base, fechaInicio: "2026-03-13", fechaFin: "2026-03-15" }))
      .toBe("13 al 15 de marzo de 2026 · 20:00 a 23:00");
    expect(eventScheduleText({ ...base, fechaInicio: "2026-03-30", fechaFin: "2026-04-02" }))
      .toBe("30 de marzo al 2 de abril de 2026 · 20:00 a 23:00");
    expect(eventScheduleText({ ...base, fechaInicio: "2026-12-31", fechaFin: "2027-01-01" }))
      .toBe("31 de diciembre de 2026 al 1 de enero de 2027 · 20:00 a 23:00");
  });

  it("links to the map only with a location", () => {
    expect(mapUrl(19.43, -99.13)).toBe("https://www.google.com/maps/search/?api=1&query=19.43,-99.13");
    expect(mapUrl(null, -99.13)).toBeNull();
  });
});
