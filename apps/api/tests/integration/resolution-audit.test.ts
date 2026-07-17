import { describe, expect, it } from "vitest";
import request from "supertest";
import { createLogger } from "@probable/logger";
import { createApp } from "../../src/app.js";
import { testConfig } from "../support/test-config.js";
import { FakeGammaClient, makeMarket } from "../support/fakes.js";
import { fakePaymentMiddleware } from "../support/fake-payment-middleware.js";
import { FakeStructuredModel } from "../support/fake-structured-model.js";

const logger = createLogger({ level: "silent", service: "test" });

function appWithLlm(llm: FakeStructuredModel, gamma = new FakeGammaClient()) {
  const config = testConfig();
  return createApp({
    config,
    logger,
    gamma,
    llm,
    paymentMiddleware: fakePaymentMiddleware(config, [
      config.routes.snapshot,
      config.routes.vitals,
      config.routes.resolution_audit,
    ]),
  });
}

describe("POST /v1/resolution-audit (paid, 0.05 USDT)", () => {
  it("returns 402 with a challenge scoped to /v1/resolution-audit when unpaid", async () => {
    const app = appWithLlm(new FakeStructuredModel());
    const res = await request(app)
      .post("/v1/resolution-audit")
      .send({ target: { market_slug: "fed-cut-rates-before-october" } });

    expect(res.status).toBe(402);
    const challenge = JSON.parse(Buffer.from(res.headers["payment-required"], "base64").toString("utf-8"));
    expect(challenge.resource.url).toContain("/v1/resolution-audit");
  });

  it("scores a fully-specified market low with no findings", async () => {
    const gamma = new FakeGammaClient();
    gamma.marketsBySlug["fed-cut-rates-before-october"] = makeMarket();
    const llm = new FakeStructuredModel();
    llm.response = { findings: [] };
    const app = appWithLlm(llm, gamma);

    const res = await request(app)
      .post("/v1/resolution-audit")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { market_slug: "fed-cut-rates-before-october" } });

    expect(res.status).toBe(200);
    expect(res.body.data.risk_score).toBe(0);
    expect(res.body.data.risk_band).toBe("LOW");
    expect(res.body.data.disclaimer).toContain("not a legal judgment");
    expect(llm.callCount).toBe(1);
  });

  it("applies the deterministic missing-resolution-source penalty without needing the LLM", async () => {
    const gamma = new FakeGammaClient();
    gamma.marketsBySlug["no-source"] = makeMarket({ slug: "no-source", resolutionSource: undefined });
    const llm = new FakeStructuredModel();
    llm.response = { findings: [] };
    const app = appWithLlm(llm, gamma);

    const res = await request(app)
      .post("/v1/resolution-audit")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { market_slug: "no-source" } });

    expect(res.status).toBe(200);
    expect(res.body.data.risk_score).toBeGreaterThan(0);
    expect(res.body.data.findings.some((f: { type: string }) => f.type === "missing_resolution_source")).toBe(true);
    expect(res.body.data.missing_information).toContain("resolution_source");
  });

  it("drops an LLM finding whose evidence isn't an exact span of the source text", async () => {
    const gamma = new FakeGammaClient();
    gamma.marketsBySlug["fed-cut-rates-before-october"] = makeMarket();
    const llm = new FakeStructuredModel();
    llm.response = {
      findings: [
        {
          type: "undefined_term",
          severity: "medium",
          evidence: "this exact phrase does not appear anywhere in the source text",
          explanation: "fabricated",
          possible_interpretations: [],
        },
      ],
    };
    const app = appWithLlm(llm, gamma);

    const res = await request(app)
      .post("/v1/resolution-audit")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { market_slug: "fed-cut-rates-before-october" } });

    expect(res.status).toBe(200);
    expect(res.body.data.findings).toHaveLength(0);
    expect(res.body.data.dropped_finding_count).toBe(1);
  });

  it("keeps an LLM finding whose evidence is an exact span of the source text", async () => {
    const gamma = new FakeGammaClient();
    gamma.marketsBySlug["fed-cut-rates-before-october"] = makeMarket({
      description: "Resolves YES if the Fed cuts rates before October 1, 2026.",
    });
    const llm = new FakeStructuredModel();
    llm.response = {
      findings: [
        {
          type: "undefined_term",
          severity: "medium",
          evidence: "Resolves YES if the Fed cuts rates before October 1, 2026.",
          explanation: "What counts as a 'cut' is not defined.",
          possible_interpretations: ["Any reduction", "A reduction of at least 25bps"],
        },
      ],
    };
    const app = appWithLlm(llm, gamma);

    const res = await request(app)
      .post("/v1/resolution-audit")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { market_slug: "fed-cut-rates-before-october" } });

    expect(res.status).toBe(200);
    expect(res.body.data.findings).toHaveLength(1);
    expect(res.body.data.dropped_finding_count).toBe(0);
    expect(res.body.data.risk_score).toBeGreaterThan(0);
  });

  it("marks llm_unavailable and still returns deterministic findings when the LLM throws", async () => {
    const gamma = new FakeGammaClient();
    gamma.marketsBySlug["fed-cut-rates-before-october"] = makeMarket();
    const llm = new FakeStructuredModel();
    llm.generate = async () => {
      throw new (await import("../../src/llm/structured-model.js")).LlmUnavailableError("down");
    };
    const app = appWithLlm(llm, gamma);

    const res = await request(app)
      .post("/v1/resolution-audit")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { market_slug: "fed-cut-rates-before-october" } });

    expect(res.status).toBe(200);
    expect(res.body.data.llm_unavailable).toBe(true);
    expect(res.body.meta.limitations).toEqual(
      expect.arrayContaining([expect.stringContaining("LLM-based findings are unavailable")]),
    );
  });
});
