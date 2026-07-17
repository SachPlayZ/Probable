import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/index.js";

describe("loadConfig", () => {
  it("boots with only defaults in development", () => {
    const config = loadConfig({ NODE_ENV: "development" });
    expect(config.port).toBe(4000);
    expect(config.routes.snapshot.price).toBe("$0.01");
    expect(config.routes.full_report.price).toBe("$0.10");
  });

  it("throws in production when payTo is still the placeholder", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://x",
        REDIS_URL: "redis://x",
      }),
    ).toThrow(/OKX_X402_PAY_TO/);
  });

  it("throws in production when database/redis are missing", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        OKX_X402_PAY_TO: "0x1111111111111111111111111111111111111111",
        OKX_X402_ASSET_ADDRESS: "0x2222222222222222222222222222222222222222",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("boots in production with real config", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://x",
      REDIS_URL: "redis://x",
      OKX_X402_PAY_TO: "0x1111111111111111111111111111111111111111",
      OKX_X402_ASSET_ADDRESS: "0x2222222222222222222222222222222222222222",
      OKX_API_KEY: "key",
      OKX_API_SECRET: "secret",
      OKX_API_PASSPHRASE: "pass",
    });
    expect(config.x402.payTo).toBe("0x1111111111111111111111111111111111111111");
    expect(config.okx.hasCredentials).toBe(true);
  });

  it("throws in production when OKX facilitator credentials are missing", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://x",
        REDIS_URL: "redis://x",
        OKX_X402_PAY_TO: "0x1111111111111111111111111111111111111111",
        OKX_X402_ASSET_ADDRESS: "0x2222222222222222222222222222222222222222",
      }),
    ).toThrow(/OKX_API_KEY/);
  });

  it("rejects a malformed price string instead of silently coercing", () => {
    expect(() => loadConfig({ PRICE_SNAPSHOT: "abc" })).toThrow();
  });
});
