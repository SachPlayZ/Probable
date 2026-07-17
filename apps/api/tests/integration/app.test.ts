import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createLogger } from "@probable/logger";
import { createApp } from "../../src/app.js";
import { testConfig } from "../support/test-config.js";
import { FakeGammaClient, FakeClobClient, makeMarket } from "../support/fakes.js";
import { fakePaymentMiddleware } from "../support/fake-payment-middleware.js";

const logger = createLogger({ level: "silent", service: "test" });

function decodePaymentRequired(header: string): {
  x402Version: number;
  resource: { url: string; description?: string; mimeType?: string };
  accepts: Array<{ scheme: string; network: string; amount: string; asset: string; payTo: string }>;
} {
  return JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
}

describe("GET /health/live", () => {
  it("returns 200 with no external calls", async () => {
    const app = createApp({ config: testConfig(), logger, gamma: new FakeGammaClient(), clob: new FakeClobClient() });
    const res = await request(app).get("/health/live");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe("POST /v1/search (free)", () => {
  let gamma: FakeGammaClient;

  beforeEach(() => {
    gamma = new FakeGammaClient();
  });

  it("returns 200 without payment and never emits an x402 challenge", async () => {
    const app = createApp({ config: testConfig(), logger, gamma, clob: new FakeClobClient() });
    const res = await request(app)
      .post("/v1/search")
      .send({ query: "Will the Fed cut rates before October?" });

    expect(res.status).toBe(200);
    expect(res.headers["payment-required"]).toBeUndefined();
    expect(res.body.ok).toBe(true);
    expect(res.body.data.matches.length).toBeGreaterThan(0);
    expect(res.body.data.matches[0].match_score).toBeGreaterThanOrEqual(0);
    expect(res.body.data.matches[0].match_score).toBeLessThanOrEqual(100);
  });

  it("rejects an empty query with 400, not 500", async () => {
    const app = createApp({ config: testConfig(), logger, gamma, clob: new FakeClobClient() });
    const res = await request(app).post("/v1/search").send({ query: "" });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("INVALID_REQUEST");
  });

  it("returns AMBIGUOUS_MARKET when top candidates score identically and are distinct markets", async () => {
    gamma.publicSearchImpl = async () => ({
      events: [
        {
          id: "evt-1",
          slug: "evt-1",
          title: "evt",
          markets: [
            makeMarket({ id: "a", question: "Will X happen?", updatedAt: new Date().toISOString() }),
            makeMarket({ id: "b", question: "Will X happen?", updatedAt: new Date().toISOString() }),
          ],
        },
      ],
    });
    const app = createApp({ config: testConfig(), logger, gamma, clob: new FakeClobClient() });
    const res = await request(app).post("/v1/search").send({ query: "Will X happen?" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("AMBIGUOUS_MARKET");
  });
});

describe("POST /v1/snapshot (paid, 0.01 USDT)", () => {
  it("returns 402 with a decodable PAYMENT-REQUIRED challenge when unpaid", async () => {
    const config = testConfig();
    const gamma = new FakeGammaClient();
    const clob = new FakeClobClient();
    const app = createApp({
      config,
      logger,
      gamma,
      clob,
      paymentMiddleware: fakePaymentMiddleware(config, [config.routes.snapshot]),
    });

    const res = await request(app)
      .post("/v1/snapshot")
      .send({ target: { market_slug: "fed-cut-rates-before-october" }, outcome: "Yes" });

    expect(res.status).toBe(402);
    const header = res.headers["payment-required"];
    expect(header).toBeDefined();

    const challenge = decodePaymentRequired(header);
    expect(challenge.x402Version).toBe(2);
    expect(challenge.resource.url).toContain("/v1/snapshot");
    expect(challenge.accepts.length).toBeGreaterThan(0);
    expect(challenge.accepts[0]?.scheme).toBe("exact");
    expect(challenge.accepts[0]?.network).toBe("eip155:196");
    expect(challenge.accepts[0]?.payTo).toBe("0x1111111111111111111111111111111111111111");
    expect(Number(challenge.accepts[0]?.amount)).toBeGreaterThan(0);
  });

  it("never invokes the business handler (no CLOB call) when payment is absent", async () => {
    const gamma = new FakeGammaClient();
    gamma.marketsBySlug["fed-cut-rates-before-october"] = makeMarket();
    const clob = new FakeClobClient();
    const app = createApp({ config: testConfig(), logger, gamma, clob });

    await request(app)
      .post("/v1/snapshot")
      .send({ target: { market_slug: "fed-cut-rates-before-october" }, outcome: "Yes" });

    expect(clob.bookCallCount).toBe(0);
  });

  it("returns 402 before ever validating the request body (payment gate runs first)", async () => {
    const config = testConfig();
    const app = createApp({
      config,
      logger,
      gamma: new FakeGammaClient(),
      clob: new FakeClobClient(),
      paymentMiddleware: fakePaymentMiddleware(config, [config.routes.snapshot]),
    });
    const res = await request(app)
      .post("/v1/snapshot")
      // Malformed target (two identifiers) would normally fail INVALID_TARGET validation —
      // but payment verification runs before body parsing, so an unpaid request never
      // reaches that check at all.
      .send({ target: { market_slug: "a", market_id: "b" }, outcome: "Yes" });

    expect(res.status).toBe(402);
  });
});
