import { envs, logger } from "./config";
import { AppRoutes } from "./presentation/routes/routes";
import { Server } from "./presentation/server";

process.on("unhandledRejection", (reason) => {
  logger.error("Promesa rechazada sin manejar", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error("Excepción no capturada", error);
  process.exit(1);
});

const bootstrap = async () => {
  const server = new Server({
    host: envs.HOST,
    port: envs.PORT,
    publicPath: envs.PUBLIC_PATH,
    routes: AppRoutes.routes,
  });

  await server.start();
};

bootstrap().catch((error) => {
  logger.error("No se pudo arrancar el servidor", error);
  process.exit(1);
});
