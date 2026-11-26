import type { CommandResult } from "../../../domain/dtos/device/heartbeat.dto";
import type { Page, PageRequest } from "../../../domain/dtos/shared/pagination";
import type {
  DeliveredCommand,
  DeviceCommand,
  TerminalSpec,
} from "../../../domain/entities/device/device-command.entity";
import type { DeviceEntity } from "../../../domain/entities/device/device.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import {
  canCancel,
  configStatusAfter,
  isDue,
  isExhausted,
  planTerminalCommands,
  terminalSpec,
  type TerminalState,
} from "../../../domain/policies/device/device-command-policy";
import type { DeviceCommandRepository } from "../../../domain/repository/device-command/device-command.repository";
import type { DeviceRepository } from "../../../domain/repository/device/device.repository";

export type CommandTiming = {
  /** A delivered command without a result is delivered again after this long. */
  retryAfterMs: number;
  /** Deliveries without a result before the command fails. */
  maxAttempts: number;
  /** Commands per heartbeat answer, so a big change does not flood the Raspberry. */
  batchSize: number;
};

const stateOf = (device: DeviceEntity | null): TerminalState | null =>
  device && device.tipo === "TERMINAL"
    ? {
        id: device.id,
        nombre: device.nombre,
        ip: device.ip,
        mac: device.mac,
        carril: device.carril,
        sentido: device.sentido,
        gatewayId: device.gatewayId,
        estado: device.estado,
      }
    : null;

const specsOf = (command: DeviceCommand): TerminalSpec[] =>
  "terminal" in command.payload ? [command.payload.terminal] : command.payload.terminales;

/** Per-terminal outcome of a SINCRONIZAR, when the gateway sends it in `datos.terminales`. */
const syncOutcomes = (datos: Record<string, unknown>) => {
  const outcomes = new Map<string, { ok: boolean; error: string }>();
  if (!Array.isArray(datos.terminales)) return outcomes;
  for (const item of datos.terminales as unknown[]) {
    if (typeof item !== "object" || item === null) continue;
    const { mac, ok, error } = item as Record<string, unknown>;
    if (typeof mac === "string" && typeof ok === "boolean") {
      outcomes.set(mac.toUpperCase(), { ok, error: typeof error === "string" ? error : "" });
    }
  }
  return outcomes;
};

/**
 * The command queue: what the dashboard asks of a gateway, delivered in the answer of its
 * heartbeats (the API never calls the Raspberry) and closed with the result it reports back.
 */
export class DeviceCommandService {
  constructor(
    private readonly commands: DeviceCommandRepository,
    private readonly devices: DeviceRepository,
    private readonly timing: CommandTiming,
  ) {}

  /** Queues what a terminal change means for its gateway(s); `after` null when it was deleted. */
  async applyTerminalChange(before: DeviceEntity | null, after: DeviceEntity | null): Promise<void> {
    const planned = planTerminalCommands(stateOf(before), stateOf(after));
    for (const command of planned) {
      await this.commands.enqueue({
        gatewayId: command.gatewayId,
        terminalId: command.terminal.terminalId,
        tipo: command.tipo,
        payload: { terminal: command.terminal },
      });
    }
    if (planned.length > 0 && after) await this.devices.setConfigStatus([after.id], "PENDIENTE");
  }

  /**
   * SINCRONIZAR: every active terminal of the gateway, so a new or reinstalled Raspberry rebuilds
   * its configuration. Returns null when the gateway has no active terminals.
   */
  async syncGateway(gateway: DeviceEntity): Promise<DeviceCommand | null> {
    const active = (await this.devices.listTerminals(gateway.id)).filter((terminal) => terminal.estado);
    const terminales = active
      .map((terminal) => terminalSpec(stateOf(terminal)!))
      .filter((spec): spec is TerminalSpec => spec !== null);
    if (terminales.length === 0) return null;
    const command = await this.commands.enqueue({
      gatewayId: gateway.id,
      terminalId: null,
      tipo: "SINCRONIZAR",
      payload: { terminales },
    });
    await this.devices.setConfigStatus(terminales.map((spec) => spec.terminalId), "PENDIENTE");
    return command;
  }

  /** Sends the configuration of one terminal again (after an error, or a replaced device). */
  async reapplyTerminal(terminal: DeviceEntity): Promise<DeviceCommand> {
    if (!terminal.estado) throw CustomError.conflict("La terminal está inactiva: actívala para configurarla");
    const spec = terminalSpec(stateOf(terminal)!);
    if (!spec || !terminal.gatewayId) throw CustomError.conflict("La terminal necesita MAC y gateway");
    const command = await this.commands.enqueue({
      gatewayId: terminal.gatewayId,
      terminalId: terminal.id,
      tipo: "CONFIGURAR_TERMINAL",
      payload: { terminal: spec },
    });
    await this.devices.setConfigStatus([terminal.id], "PENDIENTE");
    return command;
  }

  /** A gateway's queue, or the commands about one terminal. */
  list(device: DeviceEntity, page: PageRequest): Promise<Page<DeviceCommand>> {
    return this.commands.list(
      device.tipo === "GATEWAY"
        ? { projectId: device.projectId, gatewayId: device.id }
        : { projectId: device.projectId, terminalId: device.id },
      page,
    );
  }

  async cancel(device: DeviceEntity, commandId: string): Promise<DeviceCommand> {
    const command = await this.commands.findById(device.projectId, commandId);
    if (!command || (command.gatewayId !== device.id && command.terminalId !== device.id)) {
      throw CustomError.notFound("Comando no encontrado");
    }
    const error = canCancel(command.estado);
    if (error) throw CustomError.conflict(error);
    const cancelled = await this.commands.cancel(command.id);
    if (!cancelled) throw CustomError.conflict("Solo se puede cancelar un comando pendiente");
    // Its terminals would stay PENDIENTE forever: show that the change did not reach the gateway.
    await this.markTerminals(cancelled, () => ({ ok: false, error: "Comando cancelado: reaplica la configuración" }));
    return cancelled;
  }

  /**
   * Closes the commands the gateway reports and returns the ids it can forget (also repeated or
   * late results, so the Raspberry stops resending them).
   */
  async applyResults(gatewayId: string, results: CommandResult[]): Promise<string[]> {
    for (const result of results) {
      const command = await this.commands.finish(gatewayId, result.id, {
        estado: result.ok ? "APLICADO" : "ERROR",
        resultado: result.datos,
        error: result.ok ? "" : result.error || "El gateway reportó un error sin detalle",
      });
      if (!command) continue;
      const outcomes = command.tipo === "SINCRONIZAR" ? syncOutcomes(result.datos) : new Map();
      await this.markTerminals(command, (spec) => outcomes.get(spec.mac) ?? { ok: result.ok, error: command.error });
    }
    return results.map((result) => result.id);
  }

  /**
   * The commands to send in this heartbeat answer: pending ones, and delivered ones whose result
   * never came back. Those delivered too many times fail instead of retrying forever.
   */
  async deliver(gatewayId: string, now = new Date()): Promise<DeliveredCommand[]> {
    const delivered: DeliveredCommand[] = [];
    for (const command of await this.commands.listOpen(gatewayId)) {
      if (!isDue(command.estado, command.entregadoEn, now.getTime(), this.timing.retryAfterMs)) continue;
      if (command.estado === "ENTREGADO" && isExhausted(command.intentos, this.timing.maxAttempts)) {
        const failed = await this.commands.finish(gatewayId, command.id, {
          estado: "ERROR",
          resultado: {},
          error: `El gateway no confirmó el comando después de ${command.intentos} entregas`,
        });
        if (failed) await this.markTerminals(failed, () => ({ ok: false, error: failed.error }));
        continue;
      }
      if (delivered.length >= this.timing.batchSize) continue;
      if (await this.commands.markDelivered(command, now)) {
        delivered.push({ id: command.id, tipo: command.tipo, payload: command.payload, intentos: command.intentos + 1 });
      }
    }
    return delivered;
  }

  /**
   * Moves the terminals of a closed command to CONFIGURADA / RETIRADA / ERROR. Skipped when the
   * command no longer describes the terminal (it moved to another gateway, or got another MAC) or
   * when a newer command is still open: the state belongs to that one.
   */
  private async markTerminals(
    command: DeviceCommand,
    outcomeOf: (spec: TerminalSpec) => { ok: boolean; error: string },
  ): Promise<void> {
    const [open, terminals] = await Promise.all([
      this.commands.listOpen(command.gatewayId),
      this.devices.listTerminals(command.gatewayId),
    ]);
    const busy = new Set(open.flatMap((pending) => specsOf(pending).map((spec) => spec.terminalId)));
    const current = new Map(terminals.map((terminal) => [terminal.id, terminal]));
    for (const spec of specsOf(command)) {
      if (busy.has(spec.terminalId) || current.get(spec.terminalId)?.mac !== spec.mac) continue;
      const outcome = outcomeOf(spec);
      await this.devices.setConfigStatus(
        [spec.terminalId],
        configStatusAfter(command.tipo, outcome.ok),
        outcome.ok ? "" : outcome.error,
      );
    }
  }
}
