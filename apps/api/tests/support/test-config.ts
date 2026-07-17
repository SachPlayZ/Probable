import { loadConfig, type AppConfig } from "@probable/config";

export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: "test",
    OKX_X402_PAY_TO: "0x1111111111111111111111111111111111111111",
    PRICE_SNAPSHOT: "0.01",
    ...overrides,
  });
}
