import { paymentMiddleware, x402ResourceServer } from "@okxweb3/x402-express";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import type { AppConfig, PaidRouteConfig } from "@probable/config";
import type { RequestHandler } from "express";

/**
 * One route registry drives the SDK's RoutesConfig — handler code never sees
 * price/network/payTo directly (AGENTS.md §12 route-registry rule).
 */
function buildRoutesConfig(routes: PaidRouteConfig[]): Record<string, unknown> {
  const entries: Record<string, unknown> = {};
  for (const route of routes) {
    entries[`POST ${route.path}`] = {
      accepts: {
        scheme: "exact",
        network: route.network,
        payTo: route.payTo,
        price: route.price,
      },
      description: route.description,
      mimeType: "application/json",
    };
  }
  return entries;
}

export function createPaymentMiddleware(config: AppConfig, routes: PaidRouteConfig[]): RequestHandler {
  const facilitatorClient = new OKXFacilitatorClient({
    apiKey: config.okx.apiKey ?? "",
    secretKey: config.okx.apiSecret ?? "",
    passphrase: config.okx.apiPassphrase ?? "",
  });

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    // Validated as a CAIP-2 identifier ("chain:reference") in packages/config's env schema.
    config.x402.network as `${string}:${string}`,
    new ExactEvmScheme(),
  );

  const routesConfig = buildRoutesConfig(routes);

  // The facilitator's "supported kinds" sync (required even to build a 402 challenge,
  // not just to verify/settle) is an authenticated OKX endpoint — it 401s without real
  // credentials. Without them (local/dev without secrets configured), skip the eager
  // sync so the process doesn't crash on an unhandled rejection at startup; paid routes
  // will return a handled 500 instead of a real 402 until real credentials are set.
  return paymentMiddleware(
    routesConfig as never,
    resourceServer,
    undefined,
    undefined,
    config.okx.hasCredentials,
  ) as unknown as RequestHandler;
}
