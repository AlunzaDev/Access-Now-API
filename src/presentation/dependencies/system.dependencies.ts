import { HealthController } from "../routes/health/health.controller";

export const buildHealthController = () => new HealthController();
