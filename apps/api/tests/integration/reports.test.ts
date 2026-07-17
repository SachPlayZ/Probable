import { describe, expect, it } from "vitest";
import request from "supertest";
import { createLogger } from "@probable/logger";
import { createApp } from "../../src/app.js";
import { testConfig } from "../support/test-config.js";
import { FakeGammaClient } from "../support/fakes.js";

const logger = createLogger({ level: "silent", service: "test" });

describe("GET /v1/reports/:publicId (free)", () => {
  it("returns REPORT_NOT_FOUND without emitting a payment challenge when persistence isn't configured", async () => {
    const app = createApp({ config: testConfig(), logger, gamma: new FakeGammaClient() });
    const res = await request(app).get("/v1/reports/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("REPORT_NOT_FOUND");
    expect(res.headers["payment-required"]).toBeUndefined();
  });
});
