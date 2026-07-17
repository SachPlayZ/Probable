import { z } from "zod";

const usdPrice = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "price must be a plain decimal string");

const evmAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x-prefixed 20-byte address");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "preview", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  PUBLIC_WEB_URL: z.string().url().default("http://localhost:3000"),
  PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),

  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),

  POLYMARKET_GAMMA_BASE_URL: z.string().url().default("https://gamma-api.polymarket.com"),
  POLYMARKET_CLOB_BASE_URL: z.string().url().default("https://clob.polymarket.com"),
  POLYMARKET_DATA_BASE_URL: z.string().url().default("https://data-api.polymarket.com"),

  LLM_PROVIDER: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default("openai/gpt-oss-20b"),

  OKX_API_KEY: z.string().optional(),
  OKX_API_SECRET: z.string().optional(),
  OKX_API_PASSPHRASE: z.string().optional(),

  OKX_X402_NETWORK: z
    .string()
    .regex(/^[a-zA-Z0-9-]+:[a-zA-Z0-9-]+$/, "must be a CAIP-2 identifier like eip155:196")
    .default("eip155:196"),
  OKX_X402_ASSET_ADDRESS: evmAddress.default("0x0000000000000000000000000000000000000000"),
  OKX_X402_ASSET_NAME: z.string().default("USD₮0"),
  OKX_X402_ASSET_VERSION: z.string().default("1"),
  OKX_X402_PAY_TO: evmAddress.default("0x0000000000000000000000000000000000000000"),

  PRICE_SNAPSHOT: usdPrice.default("0.01"),
  PRICE_VITALS: usdPrice.default("0.03"),
  PRICE_RESOLUTION_AUDIT: usdPrice.default("0.05"),
  PRICE_CONTRADICTIONS: usdPrice.default("0.08"),
  PRICE_FULL_REPORT: usdPrice.default("0.10"),

  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type RawEnv = z.infer<typeof envSchema>;

const PLACEHOLDER_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Placeholder payment config is fine for local/test/preview so the app boots without
 * real secrets. Production must never route real money through a placeholder address.
 */
export function assertProductionReady(env: RawEnv): void {
  if (env.NODE_ENV !== "production") return;

  const problems: string[] = [];
  if (!env.DATABASE_URL) problems.push("DATABASE_URL is required in production");
  if (!env.REDIS_URL) problems.push("REDIS_URL is required in production");
  if (env.OKX_X402_PAY_TO === PLACEHOLDER_ADDRESS) {
    problems.push("OKX_X402_PAY_TO is still the placeholder address");
  }
  if (env.OKX_X402_ASSET_ADDRESS === PLACEHOLDER_ADDRESS) {
    problems.push("OKX_X402_ASSET_ADDRESS is still the placeholder address");
  }
  if (!env.OKX_API_KEY || !env.OKX_API_SECRET || !env.OKX_API_PASSPHRASE) {
    problems.push("OKX_API_KEY/OKX_API_SECRET/OKX_API_PASSPHRASE are required in production");
  }

  if (problems.length > 0) {
    throw new Error(`Refusing to boot in production with invalid configuration:\n- ${problems.join("\n- ")}`);
  }
}
