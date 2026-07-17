import { describe, expect, it } from "vitest";
import request from "supertest";
import { createLogger } from "@probable/logger";
import { createApp } from "../../src/app.js";
import { testConfig } from "../support/test-config.js";
import { FakeGammaClient, FakeClobClient, FakeDataClient, makeMarket } from "../support/fakes.js";
import { fakePaymentMiddleware } from "../support/fake-payment-middleware.js";
import { FakeStructuredModel } from "../support/fake-structured-model.js";

const logger = createLogger({ level: "silent", service: "test" });

function allRoutes(config: ReturnType<typeof testConfig>) {
  return [
    config.routes.snapshot,
    config.routes.vitals,
    config.routes.resolution_audit,
    config.routes.contradictions,
    config.routes.full_report,
  ];
}

describe("POST /v1/full-report (paid, 0.10 USDT)", () => {
  it("returns 402 with a challenge scoped to /v1/full-report when unpaid", async () => {
    const config = testConfig();
    const app = createApp({
      config,
      logger,
      gamma: new FakeGammaClient(),
      paymentMiddleware: fakePaymentMiddleware(config, allRoutes(config)),
    });

    const res = await request(app).post("/v1/full-report").send({ target: { market_slug: "x" } });
    expect(res.status).toBe(402);
    const challenge = JSON.parse(Buffer.from(res.headers["payment-required"], "base64").toString("utf-8"));
    expect(challenge.resource.url).toContain("/v1/full-report");
  });

  it("composes snapshot + vitals + resolution audit + contradictions into one report with a deterministic verdict", async () => {
    const config = testConfig();
    const gamma = new FakeGammaClient();
    gamma.marketsBySlug["fed-cut-rates-before-october"] = makeMarket();
    gamma.eventsBySlug["fed-decision-2026"] = {
      id: "evt-1",
      slug: "fed-decision-2026",
      title: "Fed decision 2026",
      markets: [makeMarket()],
    };
    const llm = new FakeStructuredModel();
    llm.response = { findings: [] };

    const app = createApp({
      config,
      logger,
      gamma,
      clob: new FakeClobClient(),
      data: new FakeDataClient(),
      llm,
      paymentMiddleware: fakePaymentMiddleware(config, allRoutes(config)),
    });

    const res = await request(app)
      .post("/v1/full-report")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { market_slug: "fed-cut-rates-before-october" }, outcome: "Yes" });

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.snapshot).toBeDefined();
    expect(data.vitals).toBeDefined();
    expect(data.resolution_audit).toBeDefined();
    expect(data.contradictions).toBeDefined();
    expect([
      "RULES_RISK_DOMINATES",
      "WEAK_MARKET_SIGNAL",
      "RELATED_MARKETS_DISAGREE",
      "STRONGER_MARKET_SIGNAL",
      "USE_WITH_CONTEXT",
    ]).toContain(data.verdict);
    expect(data.signal_confidence.score).toBeGreaterThanOrEqual(0);
    expect(data.signal_confidence.score).toBeLessThanOrEqual(100);
    expect(data.persisted).toBe(false);
    expect(data.persistence_status).toBe("not_configured");
    expect(data.section_failures).toHaveLength(0);
  });

  it("degrades gracefully when Vitals fails (no order book) without failing the whole report", async () => {
    const config = testConfig();
    const gamma = new FakeGammaClient();
    gamma.marketsBySlug["no-book"] = makeMarket({ slug: "no-book", enableOrderBook: false });
    const llm = new FakeStructuredModel();
    llm.response = { findings: [] };

    const app = createApp({
      config,
      logger,
      gamma,
      clob: new FakeClobClient(),
      data: new FakeDataClient(),
      llm,
      paymentMiddleware: fakePaymentMiddleware(config, allRoutes(config)),
    });

    const res = await request(app)
      .post("/v1/full-report")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { market_slug: "no-book" }, outcome: "Yes" });

    // Snapshot still works via the Gamma-price fallback even without an order book.
    expect(res.status).toBe(200);
    expect(res.body.data.vitals).toBeUndefined();
    expect(res.body.data.section_failures.some((f: { section: string }) => f.section === "vitals")).toBe(true);
    expect(res.body.data.snapshot).toBeDefined();
  });

  it("never invokes any business logic when payment is absent", async () => {
    const config = testConfig();
    const gamma = new FakeGammaClient();
    gamma.marketsBySlug["fed-cut-rates-before-october"] = makeMarket();
    const clob = new FakeClobClient();
    const app = createApp({ config, logger, gamma, clob, data: new FakeDataClient() });

    await request(app).post("/v1/full-report").send({ target: { market_slug: "fed-cut-rates-before-october" } });

    expect(clob.bookCallCount).toBe(0);
  });
});
