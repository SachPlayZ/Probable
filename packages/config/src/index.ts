import { envSchema, assertProductionReady, type RawEnv } from "./env-schema.js";
import { SERVICE_IDS, type ServiceId } from "./route-prices.js";

export interface PaidRouteConfig {
  serviceId: ServiceId;
  path: string;
  price: string;
  description: string;
  network: string;
  assetAddress: string;
  assetName: string;
  assetVersion: string;
  payTo: string;
}

export interface AppConfig {
  nodeEnv: RawEnv["NODE_ENV"];
  port: number;
  publicWebUrl: string;
  publicApiUrl: string;
  databaseUrl: string | undefined;
  redisUrl: string | undefined;
  polymarket: {
    gammaBaseUrl: string;
    clobBaseUrl: string;
    dataBaseUrl: string;
  };
  llm: {
    provider: string | undefined;
    apiKey: string | undefined;
    model: string;
  };
  okx: {
    apiKey: string | undefined;
    apiSecret: string | undefined;
    apiPassphrase: string | undefined;
    /** Only sync with the live OKX facilitator when real credentials are configured. */
    hasCredentials: boolean;
  };
  sentryDsn: string | undefined;
  logLevel: RawEnv["LOG_LEVEL"];
  x402: {
    network: string;
    assetAddress: string;
    assetName: string;
    assetVersion: string;
    payTo: string;
  };
  routes: Record<Exclude<ServiceId, "search">, PaidRouteConfig>;
}

/**
 * Pricing/network/recipient live only here — handler code must never hardcode
 * these values (AGENTS.md §12 route registry rule).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  assertProductionReady(parsed);

  const x402 = {
    network: parsed.OKX_X402_NETWORK,
    assetAddress: parsed.OKX_X402_ASSET_ADDRESS,
    assetName: parsed.OKX_X402_ASSET_NAME,
    assetVersion: parsed.OKX_X402_ASSET_VERSION,
    payTo: parsed.OKX_X402_PAY_TO,
  };

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    publicWebUrl: parsed.PUBLIC_WEB_URL,
    publicApiUrl: parsed.PUBLIC_API_URL,
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    polymarket: {
      gammaBaseUrl: parsed.POLYMARKET_GAMMA_BASE_URL,
      clobBaseUrl: parsed.POLYMARKET_CLOB_BASE_URL,
      dataBaseUrl: parsed.POLYMARKET_DATA_BASE_URL,
    },
    llm: {
      provider: parsed.LLM_PROVIDER,
      apiKey: parsed.LLM_API_KEY,
      model: parsed.LLM_MODEL,
    },
    okx: {
      apiKey: parsed.OKX_API_KEY,
      apiSecret: parsed.OKX_API_SECRET,
      apiPassphrase: parsed.OKX_API_PASSPHRASE,
      hasCredentials: Boolean(parsed.OKX_API_KEY && parsed.OKX_API_SECRET && parsed.OKX_API_PASSPHRASE),
    },
    sentryDsn: parsed.SENTRY_DSN,
    logLevel: parsed.LOG_LEVEL,
    x402,
    routes: {
      snapshot: {
        serviceId: "snapshot",
        path: "/v1/snapshot",
        price: `$${parsed.PRICE_SNAPSHOT}`,
        description:
          "Timestamped implied probability with bid, ask, spread, price method, movement, and market-quality score.",
        ...x402,
      },
      vitals: {
        serviceId: "vitals",
        path: "/v1/vitals",
        price: `$${parsed.PRICE_VITALS}`,
        description:
          "Order-book depth, fill cost, price impact, open interest, activity, concentration, exit difficulty.",
        ...x402,
      },
      resolution_audit: {
        serviceId: "resolution_audit",
        path: "/v1/resolution-audit",
        price: `$${parsed.PRICE_RESOLUTION_AUDIT}`,
        description:
          "Audit of a market's question and resolution rules for ambiguity and edge-case risk.",
        ...x402,
      },
      contradictions: {
        serviceId: "contradictions",
        path: "/v1/contradictions",
        price: `$${parsed.PRICE_CONTRADICTIONS}`,
        description: "Candidate probability inconsistencies across related markets.",
        ...x402,
      },
      full_report: {
        serviceId: "full_report",
        path: "/v1/full-report",
        price: `$${parsed.PRICE_FULL_REPORT}`,
        description:
          "Complete timestamped market report: probability, market health, resolution risk, related-market analysis.",
        ...x402,
      },
    },
  };
}

export { SERVICE_IDS };
export type { ServiceId, RawEnv };
