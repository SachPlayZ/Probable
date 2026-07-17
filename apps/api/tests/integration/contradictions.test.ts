import { describe, expect, it } from "vitest";
import request from "supertest";
import { createLogger } from "@probable/logger";
import { createApp } from "../../src/app.js";
import { testConfig } from "../support/test-config.js";
import { FakeGammaClient, FakeClobClient, makeMarket } from "../support/fakes.js";
import { fakePaymentMiddleware } from "../support/fake-payment-middleware.js";

const logger = createLogger({ level: "silent", service: "test" });

function appFor(gamma: FakeGammaClient, clob: FakeClobClient) {
  const config = testConfig();
  return createApp({
    config,
    logger,
    gamma,
    clob,
    paymentMiddleware: fakePaymentMiddleware(config, [
      config.routes.snapshot,
      config.routes.vitals,
      config.routes.resolution_audit,
      config.routes.contradictions,
    ]),
  });
}

describe("POST /v1/contradictions (paid, 0.08 USDT)", () => {
  it("returns 402 with a challenge scoped to /v1/contradictions when unpaid", async () => {
    const app = appFor(new FakeGammaClient(), new FakeClobClient());
    const res = await request(app).post("/v1/contradictions").send({ target: { event_slug: "some-event" } });
    expect(res.status).toBe(402);
    const challenge = JSON.parse(Buffer.from(res.headers["payment-required"], "base64").toString("utf-8"));
    expect(challenge.resource.url).toContain("/v1/contradictions");
  });

  it("flags an overpriced negRisk multi-outcome group", async () => {
    const gamma = new FakeGammaClient();
    const markets = [
      makeMarket({ id: "a", slug: "a", outcomes: ["Yes", "No"], outcomePrices: ["0.4", "0.6"], negRisk: true, clobTokenIds: ["ta", "ta-no"], enableOrderBook: false }),
      makeMarket({ id: "b", slug: "b", outcomes: ["Yes", "No"], outcomePrices: ["0.4", "0.6"], negRisk: true, clobTokenIds: ["tb", "tb-no"], enableOrderBook: false }),
      makeMarket({ id: "c", slug: "c", outcomes: ["Yes", "No"], outcomePrices: ["0.4", "0.6"], negRisk: true, clobTokenIds: ["tc", "tc-no"], enableOrderBook: false }),
    ];
    gamma.eventsBySlug["candidates-event"] = { id: "evt", slug: "candidates-event", title: "Who wins?", markets };
    const clob = new FakeClobClient();
    const app = appFor(gamma, clob);

    const res = await request(app)
      .post("/v1/contradictions")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { event_slug: "candidates-event" }, scan_modes: ["multi_outcome_sum"] });

    expect(res.status).toBe(200);
    // 0.4 + 0.4 + 0.4 = 1.2, well past the buffer
    expect(res.body.data.candidates).toHaveLength(1);
    expect(res.body.data.candidates[0].type).toBe("multi_outcome_sum");
    expect(res.body.data.candidates[0].relationship).toBe("mutually_exclusive_exhaustive_outcome_set");
    // never claims guaranteed arbitrage
    expect(JSON.stringify(res.body.data)).not.toContain("guaranteed arbitrage");
  });

  it("does not flag a well-priced negRisk group within the buffer", async () => {
    const gamma = new FakeGammaClient();
    const markets = [
      makeMarket({ id: "a", slug: "a", outcomes: ["Yes", "No"], outcomePrices: ["0.33", "0.67"], negRisk: true, clobTokenIds: ["ta", "ta-no"], enableOrderBook: false }),
      makeMarket({ id: "b", slug: "b", outcomes: ["Yes", "No"], outcomePrices: ["0.33", "0.67"], negRisk: true, clobTokenIds: ["tb", "tb-no"], enableOrderBook: false }),
      makeMarket({ id: "c", slug: "c", outcomes: ["Yes", "No"], outcomePrices: ["0.34", "0.66"], negRisk: true, clobTokenIds: ["tc", "tc-no"], enableOrderBook: false }),
    ];
    gamma.eventsBySlug["tight-event"] = { id: "evt2", slug: "tight-event", title: "Close race", markets };
    const app = appFor(gamma, new FakeClobClient());

    const res = await request(app)
      .post("/v1/contradictions")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { event_slug: "tight-event" }, scan_modes: ["multi_outcome_sum"] });

    expect(res.status).toBe(200);
    expect(res.body.data.candidates).toHaveLength(0);
  });

  it("returns an empty candidate list with a warning for an event with only one market", async () => {
    const gamma = new FakeGammaClient();
    gamma.eventsBySlug["solo-event"] = {
      id: "evt3",
      slug: "solo-event",
      title: "Solo",
      markets: [makeMarket({ id: "solo" })],
    };
    const app = appFor(gamma, new FakeClobClient());

    const res = await request(app)
      .post("/v1/contradictions")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { event_slug: "solo-event" } });

    expect(res.status).toBe(200);
    expect(res.body.data.candidates).toHaveLength(0);
    expect(res.body.data.warnings.length).toBeGreaterThan(0);
  });

  it("labels logical_implication as not-yet-implemented rather than fabricating a result", async () => {
    const gamma = new FakeGammaClient();
    gamma.eventsBySlug["solo-event"] = {
      id: "evt3",
      slug: "solo-event",
      title: "Solo",
      markets: [makeMarket({ id: "solo" }), makeMarket({ id: "solo2", slug: "solo2" })],
    };
    const app = appFor(gamma, new FakeClobClient());

    const res = await request(app)
      .post("/v1/contradictions")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { event_slug: "solo-event" }, scan_modes: ["logical_implication"] });

    expect(res.status).toBe(200);
    expect(res.body.data.scan_modes_run).not.toContain("logical_implication");
    expect(res.body.data.warnings.join(" ")).toContain("logical_implication");
  });
});
