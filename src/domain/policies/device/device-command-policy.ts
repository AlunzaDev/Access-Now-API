import type {
  DeviceCommandStatus,
  DeviceCommandType,
  TerminalSpec,
} from "../../entities/device/device-command.entity";
import type { DeviceConfigStatus, DeviceDirection } from "../../entities/device/device.entity";

/** What the queue needs to know about a terminal to decide which commands it generates. */
export type TerminalState = {
  id: string;
  nombre: string;
  ip: string;
  mac: string | null;
  carril: string | null;
  sentido: DeviceDirection | null;
  gatewayId: string | null;
  estado: boolean;
};

export type PlannedCommand = {
  tipo: Extract<DeviceCommandType, "CONFIGURAR_TERMINAL" | "ELIMINAR_TERMINAL">;
  gatewayId: string;
  terminal: TerminalSpec;
};

export const terminalSpec = (terminal: TerminalState): TerminalSpec | null =>
  terminal.mac
    ? {
        terminalId: terminal.id,
        nombre: terminal.nombre,
        ip: terminal.ip,
        mac: terminal.mac,
        carril: terminal.carril,
        sentido: terminal.sentido ?? "ENTRADA",
      }
    : null;

const command = (tipo: PlannedCommand["tipo"], terminal: TerminalState): PlannedCommand[] => {
  const spec = terminalSpec(terminal);
  return spec && terminal.gatewayId ? [{ tipo, gatewayId: terminal.gatewayId, terminal: spec }] : [];
};

/**
 * Commands a terminal change must send to the gateways (before = null: created; after = null:
 * deleted). Only active terminals live on a gateway. Moving a terminal to another gateway, or
 * replacing its MAC (another physical device), removes it from where it was and configures it
 * again; network or lane changes reconfigure it; a rename needs nothing.
 */
export const planTerminalCommands = (
  before: TerminalState | null,
  after: TerminalState | null,
): PlannedCommand[] => {
  const wasActive = Boolean(before?.estado);
  const isActive = Boolean(after?.estado);
  if (!wasActive && !isActive) return [];
  if (!isActive) return command("ELIMINAR_TERMINAL", before!);
  if (!wasActive) return command("CONFIGURAR_TERMINAL", after!);

  const previous = before!;
  const current = after!;
  if (previous.gatewayId !== current.gatewayId || previous.mac !== current.mac) {
    return [...command("ELIMINAR_TERMINAL", previous), ...command("CONFIGURAR_TERMINAL", current)];
  }
  const changed = previous.ip !== current.ip
    || previous.carril !== current.carril
    || previous.sentido !== current.sentido;
  return changed ? command("CONFIGURAR_TERMINAL", current) : [];
};

/** The terminal's configuration once its gateway reports the result of a command. */
export const configStatusAfter = (
  tipo: DeviceCommandType,
  ok: boolean,
): Exclude<DeviceConfigStatus, "PENDIENTE"> => {
  if (!ok) return "ERROR";
  return tipo === "ELIMINAR_TERMINAL" ? "RETIRADA" : "CONFIGURADA";
};

/**
 * A command is due when it was never delivered, or when it was delivered but the gateway did not
 * report a result within `retryAfterMs` (the answer got lost or the Raspberry restarted).
 */
export const isDue = (
  estado: DeviceCommandStatus,
  deliveredAtMs: number | null,
  nowMs: number,
  retryAfterMs: number,
): boolean =>
  estado === "PENDIENTE"
  || (estado === "ENTREGADO" && (deliveredAtMs === null || nowMs - deliveredAtMs >= retryAfterMs));

/** After this many deliveries without a result the command fails instead of retrying forever. */
export const isExhausted = (attempts: number, maxAttempts: number): boolean => attempts >= maxAttempts;

/** Only a command the gateway has not received can be cancelled; a delivered one may already run. */
export const canCancel = (estado: DeviceCommandStatus): string | undefined =>
  estado === "PENDIENTE" ? undefined : "Solo se puede cancelar un comando pendiente";
