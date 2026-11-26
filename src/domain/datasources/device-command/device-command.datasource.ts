import type { Page, PageRequest } from "../../dtos/shared/pagination";
import type {
  DeviceCommand,
  DeviceCommandPayload,
  DeviceCommandStatus,
  DeviceCommandType,
} from "../../entities/device/device-command.entity";

export type NewDeviceCommand = {
  gatewayId: string;
  terminalId: string | null;
  tipo: DeviceCommandType;
  payload: DeviceCommandPayload;
};

/** Commands of one gateway, or the ones about one terminal; always inside a project. */
export type DeviceCommandFilters = {
  projectId: string;
  gatewayId?: string;
  terminalId?: string;
};

export type CommandOutcome = {
  estado: Extract<DeviceCommandStatus, "APLICADO" | "ERROR">;
  resultado: Record<string, unknown>;
  error: string;
};

export interface DeviceCommandDatasource {
  /**
   * Queues a command and, in the same transaction, cancels the pending ones it replaces (same
   * gateway and same terminal MAC, or another pending SINCRONIZAR): only the latest state travels.
   */
  enqueue(command: NewDeviceCommand): Promise<DeviceCommand>;
  findById(projectId: string, id: string): Promise<DeviceCommand | null>;
  list(filters: DeviceCommandFilters, page: PageRequest): Promise<Page<DeviceCommand>>;
  /** Commands of a gateway still waiting for a result (PENDIENTE or ENTREGADO), oldest first. */
  listOpen(gatewayId: string): Promise<DeviceCommand[]>;
  /**
   * Marks a command delivered only if nobody changed it since it was read (optimistic: two
   * overlapping heartbeats never deliver the same command twice). Returns whether it was marked.
   */
  markDelivered(command: Pick<DeviceCommand, "id" | "estado" | "intentos">, at: Date): Promise<boolean>;
  /** Closes a delivered command of that gateway; null when it is not open (late or repeated result). */
  finish(gatewayId: string, id: string, outcome: CommandOutcome): Promise<DeviceCommand | null>;
  /** Cancels a pending command; null when it is no longer pending. */
  cancel(id: string): Promise<DeviceCommand | null>;
}
