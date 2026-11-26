import type { AuditFields } from "../shared/audit.entity";
import type { DeviceDirection } from "./device.entity";

export const DEVICE_COMMAND_TYPES = ["CONFIGURAR_TERMINAL", "ELIMINAR_TERMINAL", "SINCRONIZAR"] as const;
export const DEVICE_COMMAND_STATUSES = ["PENDIENTE", "ENTREGADO", "APLICADO", "ERROR", "CANCELADO"] as const;

export type DeviceCommandType = (typeof DEVICE_COMMAND_TYPES)[number];
export type DeviceCommandStatus = (typeof DEVICE_COMMAND_STATUSES)[number];

/** What the gateway needs to configure (or remove) one terminal on its local network. */
export type TerminalSpec = {
  terminalId: string;
  nombre: string;
  ip: string;
  mac: string;
  carril: string | null;
  sentido: DeviceDirection;
};

/**
 * CONFIGURAR_TERMINAL and ELIMINAR_TERMINAL carry one terminal; SINCRONIZAR carries every active
 * terminal of the gateway so a new or reinstalled Raspberry can rebuild its configuration.
 */
export type DeviceCommandPayload =
  | { terminal: TerminalSpec }
  | { terminales: TerminalSpec[] };

/**
 * An order for a gateway. The API never calls the Raspberry: the command waits in the queue and
 * travels in the answer of the next heartbeat; the gateway reports the result in a later one.
 */
export type DeviceCommand = AuditFields & {
  id: string;
  gatewayId: string;
  terminalId: string | null;
  tipo: DeviceCommandType;
  estado: DeviceCommandStatus;
  payload: DeviceCommandPayload;
  resultado: Record<string, unknown>;
  error: string;
  intentos: number;
  entregadoEn: number | null;
  finalizadoEn: number | null;
};

/** The shape sent to the gateway in the heartbeat answer. */
export type DeliveredCommand = Pick<DeviceCommand, "id" | "tipo" | "payload" | "intentos">;

export const isFinished = (estado: DeviceCommandStatus) =>
  estado === "APLICADO" || estado === "ERROR" || estado === "CANCELADO";
