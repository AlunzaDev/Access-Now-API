import { logger } from "../../../config/logger";
import type { GatewayService } from "./gateway.service";

/** Periodically marks offline the gateways that stopped sending heartbeats. */
export class DevicePresenceMonitor {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<unknown> | null = null;

  constructor(
    private readonly gateways: GatewayService,
    private readonly intervalMs: number,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref();
  }

  /** Stops the timer and waits for a check in progress (server shutdown). */
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.running;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = this.gateways
      .markStaleOffline()
      .catch((error: unknown) => logger.error("Falló la revisión de presencia de dispositivos", error))
      .finally(() => {
        this.running = null;
      });
    await this.running;
  }
}
