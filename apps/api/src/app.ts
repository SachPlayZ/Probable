import express, { type Express, type RequestHandler } from "express";
import type { AppConfig } from "@probable/config";
import type { Logger } from "@probable/logger";
import { GammaClient, ClobClient } from "@probable/polymarket";
import { requestContext } from "./middleware/request-context.js";
import { bodySizeGuard } from "./middleware/body-size-guard.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createPaymentMiddleware } from "./config/payments.js";
import { healthRouter } from "./routes/health.route.js";
import { searchRouter } from "./routes/search.route.js";
import { snapshotRouter } from "./routes/snapshot.route.js";

export interface AppDependencies {
  config: AppConfig;
  logger: Logger;
  gamma?: GammaClient;
  clob?: ClobClient;
  /**
   * Overrides the real x402 middleware. Production always uses the official SDK
   * (config/payments.ts); tests may inject a schema-faithful fake so the suite
   * doesn't depend on live OKX facilitator credentials (AGENTS.md §12 still applies —
   * this only swaps the *transport*, never hand-rolled verification logic).
   */
  paymentMiddleware?: RequestHandler;
}

/**
 * Middleware order follows PLAN.md §16.2 exactly: request ID → size guard →
 * x402 → JSON body parsing → route validation/handler. Payment verification
 * must run before any Polymarket or LLM call for a paid route.
 */
export function createApp(deps: AppDependencies): Express {
  const { config, logger } = deps;
  const gamma = deps.gamma ?? new GammaClient({ baseUrl: config.polymarket.gammaBaseUrl });
  const clob = deps.clob ?? new ClobClient({ baseUrl: config.polymarket.clobBaseUrl });

  const app = express();
  app.disable("x-powered-by");

  app.use(requestContext(logger));
  app.use(bodySizeGuard());
  app.use(deps.paymentMiddleware ?? createPaymentMiddleware(config, [config.routes.snapshot]));
  app.use(express.json({ limit: "32kb" }));

  app.use("/health", healthRouter());
  app.use("/v1/search", searchRouter(gamma));
  app.use("/v1/snapshot", snapshotRouter(gamma, clob));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
