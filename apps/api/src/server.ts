import { loadConfig } from "@probable/config";
import { createLogger } from "@probable/logger";
import { createApp } from "./app.js";

const config = loadConfig();
const logger = createLogger({ level: config.logLevel, service: "probable-api" });

const app = createApp({ config, logger });

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, nodeEnv: config.nodeEnv }, "probable-api listening");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "shutting down");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
