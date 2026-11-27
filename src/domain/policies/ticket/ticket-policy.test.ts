import { describe, expect, it } from "vitest";
import {
  canCancelTicket,
  canChangeTicket,
  canIssueTickets,
  accessRejection,
  ticketAccessStatus,
  validateTicketCapacity,
} from "./ticket-policy";

describe("ticket policy", () => {
  it("enforces optional capacity", () => {
    expect(validateTicketCapacity(null, 500, 100)).toBeNull();
    expect(validateTicketCapacity(10, 8, 2)).toBeNull();
    expect(validateTicketCapacity(10, 8, 3)).toContain("2 boleto");
  });

  it("calculates access without persisting time-derived states", () => {
    const base = {
      estadoVenta: "VENDIDO" as const,
      usadoEn: null,
      fechaInicio: "2026-11-27",
      fechaFin: "2026-11-27",
      horaInicio: "10:00",
      horaFin: "20:00",
      zonaHoraria: "America/Mexico_City",
      eventoActivo: true,
    };
    expect(ticketAccessStatus({ ...base, now: new Date("2026-11-27T18:00:00Z") })).toBe("VIGENTE");
    expect(ticketAccessStatus({ ...base, now: new Date("2026-11-28T04:00:00Z") })).toBe("NO_UTILIZADO");
    expect(ticketAccessStatus({ ...base, usadoEn: Date.now() })).toBe("USADO");
    expect(ticketAccessStatus({ ...base, estadoVenta: "CANCELADO" })).toBe("ANULADO");
  });

  it("lets nobody in to a deactivated event and only sold tickets count", () => {
    const base = {
      estadoVenta: "VENDIDO" as const,
      usadoEn: null,
      fechaInicio: "2026-11-27",
      fechaFin: "2026-11-27",
      horaInicio: "10:00",
      horaFin: "20:00",
      zonaHoraria: "America/Mexico_City",
      now: new Date("2026-11-27T18:00:00Z"),
    };
    expect(ticketAccessStatus({ ...base, eventoActivo: false })).toBe("EVENTO_INACTIVO");
    expect(ticketAccessStatus({ ...base, eventoActivo: true, estadoVenta: "RESERVADO" })).toBe("NO_VENDIDO");
    expect(canIssueTickets(false)).toContain("inactivo");
    expect(canIssueTickets(true)).toBeNull();
  });

  it("allows only truthful sale changes", () => {
    const available = { estadoVenta: "DISPONIBLE" as const, usadoEn: null };
    const sold = { estadoVenta: "VENDIDO" as const, usadoEn: null };
    expect(canChangeTicket(available, "VENDIDO")).toBeNull();
    expect(canChangeTicket({ estadoVenta: "RESERVADO", usadoEn: null }, "DISPONIBLE")).toBeNull();
    expect(canChangeTicket(sold, "DISPONIBLE")).toContain("cancélalo");
    expect(canChangeTicket(sold, "VENDIDO")).toBeNull();
    expect(canChangeTicket({ ...sold, usadoEn: 1 })).toContain("utilizado");
    expect(canChangeTicket({ estadoVenta: "CANCELADO", usadoEn: null })).toContain("anulado");
  });

  it("tells the terminal why a ticket does not get in", () => {
    expect(accessRejection("VIGENTE")).toBeNull();
    expect(accessRejection("USADO")).toBe("El boleto ya fue utilizado");
    expect(accessRejection("NO_UTILIZADO")).toBe("El evento ya terminó");
  });

  it("cancels once and never a used ticket", () => {
    expect(canCancelTicket({ estadoVenta: "VENDIDO", usadoEn: null })).toBeNull();
    expect(canCancelTicket({ estadoVenta: "VENDIDO", usadoEn: 1 })).toContain("utilizado");
    expect(canCancelTicket({ estadoVenta: "CANCELADO", usadoEn: null })).toContain("ya está cancelado");
  });
});
