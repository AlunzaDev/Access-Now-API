import { describe, expect, it } from "vitest";
import {
  canCancel,
  configStatusAfter,
  isDue,
  isExhausted,
  planTerminalCommands,
  type TerminalState,
} from "./device-command-policy";

const terminal: TerminalState = {
  id: "t1",
  nombre: "Torniquete 1",
  ip: "10.0.0.10",
  mac: "AA:BB:CC:DD:EE:01",
  puertaId: "door-1",
  sentido: "ENTRADA",
  gatewayId: "g1",
  estado: true,
};

const kinds = (planned: ReturnType<typeof planTerminalCommands>) =>
  planned.map((command) => `${command.tipo}@${command.gatewayId}`);

describe("planTerminalCommands", () => {
  it("configures a new active terminal and ignores an inactive one", () => {
    expect(kinds(planTerminalCommands(null, terminal))).toEqual(["CONFIGURAR_TERMINAL@g1"]);
    expect(planTerminalCommands(null, { ...terminal, estado: false })).toEqual([]);
  });

  it("removes a deleted or deactivated terminal from its gateway", () => {
    expect(kinds(planTerminalCommands(terminal, null))).toEqual(["ELIMINAR_TERMINAL@g1"]);
    expect(kinds(planTerminalCommands(terminal, { ...terminal, estado: false }))).toEqual(["ELIMINAR_TERMINAL@g1"]);
    expect(planTerminalCommands({ ...terminal, estado: false }, null)).toEqual([]);
  });

  it("configures a reactivated terminal", () => {
    expect(kinds(planTerminalCommands({ ...terminal, estado: false }, terminal))).toEqual(["CONFIGURAR_TERMINAL@g1"]);
  });

  it("moves a terminal between gateways: remove from the old one, configure on the new one", () => {
    expect(kinds(planTerminalCommands(terminal, { ...terminal, gatewayId: "g2" }))).toEqual([
      "ELIMINAR_TERMINAL@g1",
      "CONFIGURAR_TERMINAL@g2",
    ]);
  });

  it("treats a new MAC as another physical device", () => {
    const planned = planTerminalCommands(terminal, { ...terminal, mac: "AA:BB:CC:DD:EE:02" });
    expect(kinds(planned)).toEqual(["ELIMINAR_TERMINAL@g1", "CONFIGURAR_TERMINAL@g1"]);
    expect(planned[0].terminal.mac).toBe("AA:BB:CC:DD:EE:01");
    expect(planned[1].terminal.mac).toBe("AA:BB:CC:DD:EE:02");
  });

  it("reconfigures on network or lane changes, not on a rename", () => {
    expect(kinds(planTerminalCommands(terminal, { ...terminal, ip: "10.0.0.11" }))).toEqual(["CONFIGURAR_TERMINAL@g1"]);
    expect(kinds(planTerminalCommands(terminal, { ...terminal, puertaId: "door-2" }))).toEqual([
      "CONFIGURAR_TERMINAL@g1",
    ]);
    expect(kinds(planTerminalCommands(terminal, { ...terminal, sentido: "SALIDA" }))).toEqual(["CONFIGURAR_TERMINAL@g1"]);
    expect(planTerminalCommands(terminal, { ...terminal, nombre: "Otro nombre" })).toEqual([]);
  });

  it("snapshots what was requested", () => {
    expect(planTerminalCommands(null, terminal)[0].terminal).toEqual({
      terminalId: "t1",
      nombre: "Torniquete 1",
      ip: "10.0.0.10",
      mac: "AA:BB:CC:DD:EE:01",
      puertaId: "door-1",
      sentido: "ENTRADA",
    });
  });
});

describe("command lifecycle", () => {
  it("maps a result to the terminal configuration", () => {
    expect(configStatusAfter("CONFIGURAR_TERMINAL", true)).toBe("CONFIGURADA");
    expect(configStatusAfter("SINCRONIZAR", true)).toBe("CONFIGURADA");
    expect(configStatusAfter("ELIMINAR_TERMINAL", true)).toBe("RETIRADA");
    expect(configStatusAfter("CONFIGURAR_TERMINAL", false)).toBe("ERROR");
  });

  it("delivers pending commands and retries delivered ones without a result", () => {
    expect(isDue("PENDIENTE", null, 1_000, 500)).toBe(true);
    expect(isDue("ENTREGADO", 800, 1_000, 500)).toBe(false);
    expect(isDue("ENTREGADO", 400, 1_000, 500)).toBe(true);
    expect(isDue("APLICADO", 0, 1_000, 500)).toBe(false);
    expect(isExhausted(5, 5)).toBe(true);
    expect(isExhausted(4, 5)).toBe(false);
  });

  it("cancels only commands the gateway has not received", () => {
    expect(canCancel("PENDIENTE")).toBeUndefined();
    expect(canCancel("ENTREGADO")).toBeDefined();
  });
});
