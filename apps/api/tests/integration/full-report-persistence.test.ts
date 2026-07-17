import { describe, expect, it } from "vitest";
import request from "supertest";
import { createLogger } from "@probable/logger";
import { createDatabase, ReportsRepository } from "@probable/db";
import { createApp } from "../../src/app.js";
import { testConfig } from "../support/test-config.js";
import { FakeGammaClient, FakeClobClient, FakeDataClient, makeMarket } from "../support/fakes.js";
import { fakePaymentMiddleware } from "../support/fake-payment-middleware.js";
import { FakeStructuredModel } from "../support/fake-structured-model.js";

const logger = createLogger({ level: "silent", service: "test" });
const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("POST /v1/full-report persistence (live Postgres)", () => {
  const reportsRepo = new ReportsRepository(createDatabase(DATABASE_URL!));

  function app() {
    const config = testConfig();
    const gamma = new FakeGammaClient();
    gamma.marketsBySlug["fed-cut-rates-before-october"] = makeMarket();
    const llm = new FakeStructuredModel();
    llm.response = { findings: [] };
    return createApp({
      config,
      logger,
      gamma,
      clob: new FakeClobClient(),
      data: new FakeDataClient(),
      llm,
      reportsRepo,
      paymentMiddleware: fakePaymentMiddleware(config, [
        config.routes.snapshot,
        config.routes.vitals,
        config.routes.resolution_audit,
        config.routes.contradictions,
        config.routes.full_report,
      ]),
    });
  }

  it("persists a real row and returns a report_url", async () => {
    const res = await request(app())
      .post("/v1/full-report")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { market_slug: "fed-cut-rates-before-october" }, outcome: "Yes" });

    expect(res.status).toBe(200);
    expect(res.body.data.persisted).toBe(true);
    expect(res.body.data.persistence_status).toBe("persisted");
    expect(res.body.data.report_url).toMatch(/\/reports\//);

    const publicId = res.body.data.report_url.split("/reports/")[1];
    const stored = await reportsRepo.findByPublicId(publicId);
    expect(stored?.marketId).toBe("mkt-1");
  });

  it("returns the same report for a reused idempotency_key with the same payload", async () => {
    const key = `idem-${Date.now()}`;
    const first = await request(app())
      .post("/v1/full-report")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { market_slug: "fed-cut-rates-before-october" }, outcome: "Yes", idempotency_key: key });

    const second = await request(app())
      .post("/v1/full-report")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { market_slug: "fed-cut-rates-before-october" }, outcome: "Yes", idempotency_key: key });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.report_url).toBe(first.body.data.report_url);
  });

  it("returns 409 IDEMPOTENCY_CONFLICT for a reused key with a different payload", async () => {
    const key = `idem-conflict-${Date.now()}`;
    await request(app())
      .post("/v1/full-report")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { market_slug: "fed-cut-rates-before-october" }, outcome: "Yes", idempotency_key: key });

    const conflict = await request(app())
      .post("/v1/full-report")
      .set("x-payment", "fake-signed-payload")
      .send({ target: { market_slug: "fed-cut-rates-before-october" }, outcome: "No", idempotency_key: key });

    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });
});
