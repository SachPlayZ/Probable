import { describe, expect, it } from "vitest";
import request from "supertest";
import { createLogger } from "@probable/logger";
import { createApp } from "../../src/app.js";
import { testConfig } from "../support/test-config.js";
import { FakeGammaClient, FakeClobClient, FakeDataClient, makeMarket } from "../support/fakes.js";
import { fakePaymentMiddleware } from "../support/fake-payment-middleware.js";

const logger = createLogger({ level: "silent", service: "test" });

describe("POST /v1/vitals (paid, 0.03 USDT)", () => {
  it("returns 402 with a decodable challenge scoped to /v1/vitals when unpaid", async () => {
    const config = testConfig();
    const app = createApp({
      config,
      logger,
      gamma: new FakeGammaClient(),
      clob: new FakeClobClient(),
      data: new FakeDataClient(),
      paymentMiddleware: fakePaymentMiddleware(config, [config.routes.snapshot, config.routes.vitals]),
    });

    const res = await request(app)
      .post("/v1/vitals")
      .send({ target: { market_slug: "fed-cut-rates-before-october" }, outcome: "Yes" });

    expect(res.status).toBe(402);
    const challenge = JSON.parse(Buffer.from(res.headers["payment-required"], "base64").toString("utf-8"));
    expect(challenge.resource.url).toContain("/v1/vitals");
    expect(challenge.accepts[0]?.scheme).toBe("exact");
  });

  it("returns a full vitals report with a paid header (via fake middleware)", async () => {
    const config = testConfig();
    const gamma = new FakeGammaClient();
    gamma.marketsBySlug["fed-cut-rates-before-october"] = makeMarket();
    const app = createApp({
      config,
      logger,
      gamma,
      clob: new FakeClobClient(),
      data: new FakeDataClient(),
      paymentMiddleware: fakePaymentMiddleware(config, [config.routes.snapshot, config.routes.vitals]),
    });

    const res = await request(app)
      .post("/v1/vitals")
      .set("x-payment", "fake-signed-payload")
      .send({
        target: { market_slug: "fed-cut-rates-before-october" },
        outcome: "Yes",
        trade_sizes_usd: [100, 500],
        depth_bands: [0.01, 0.05],
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const data = res.body.data;
    expect(data.best_bid).toBe("0.6");
    expect(data.best_ask).toBe("0.64");
    expect(data.depth).toHaveLength(2);
    expect(data.fills).toHaveLength(2);
    expect(data.quality_score).toBeGreaterThanOrEqual(0);
    expect(data.quality_score).toBeLessThanOrEqual(100);
    expect(["easy", "moderate", "hard", "unknown"]).toContain(data.fills[0].exit_difficulty);
  });

  it("returns MARKET_NOT_ORDERBOOK_ENABLED for a market without order-book trading", async () => {
    const config = testConfig();
    const gamma = new FakeGammaClient();
    gamma.marketsBySlug["no-book"] = makeMarket({ slug: "no-book", enableOrderBook: false });
    const app = createApp({
      config,
      logger,
      gamma,
      clob: new FakeClobClient(),
      data: new FakeDataClient(),
      paymentMiddleware: fakePaymentMiddleware(config, [config.routes.snapshot, config.routes.vitals]),
    });

    const res = await request(app)
      .post("/v1/vitals")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { market_slug: "no-book" }, outcome: "Yes" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("MARKET_NOT_ORDERBOOK_ENABLED");
  });

  it("never invokes the CLOB book fetch when payment is absent", async () => {
    const config = testConfig();
    const gamma = new FakeGammaClient();
    gamma.marketsBySlug["fed-cut-rates-before-october"] = makeMarket();
    const clob = new FakeClobClient();
    const app = createApp({ config, logger, gamma, clob, data: new FakeDataClient() });

    await request(app)
      .post("/v1/vitals")
      .send({ target: { market_slug: "fed-cut-rates-before-october" }, outcome: "Yes" });

    expect(clob.bookCallCount).toBe(0);
  });
});
