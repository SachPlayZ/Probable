import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "../src/client.js";
import { ReportsRepository } from "../src/repositories/reports.repository.js";

const DATABASE_URL = process.env.DATABASE_URL;
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("ReportsRepository (live Postgres)", () => {
  let db: Database;
  let repo: ReportsRepository;

  beforeAll(() => {
    db = createDatabase(DATABASE_URL!);
    repo = new ReportsRepository(db);
  });

  afterAll(async () => {
    // @ts-expect-error — drizzle's node-postgres client exposes the underlying pool for teardown.
    await db.$client?.end?.();
  });

  it("creates a report with a random non-sequential public_id and reads it back", async () => {
    const created = await repo.create({
      service: "snapshot",
      requestHash: `hash-${Date.now()}-a`,
      requestPayload: { target: { market_slug: "test-market" } },
      resultPayload: { implied_probability_percent: "62" },
      methodologyVersion: "1.0.0",
      marketId: "mkt-123",
      eventId: "evt-456",
      dataAsOf: new Date(),
      generatedAt: new Date(),
      isPublic: true,
    });

    expect(created.publicId).toBeTruthy();
    expect(created.publicId.length).toBeGreaterThanOrEqual(8);
    expect(created.service).toBe("snapshot");

    const fetched = await repo.findByPublicId(created.publicId);
    expect(fetched?.marketId).toBe("mkt-123");
    expect(fetched?.resultPayload).toEqual({ implied_probability_percent: "62" });
  });

  it("supports idempotency lookup by request_hash", async () => {
    const requestHash = `hash-${Date.now()}-b`;
    const created = await repo.create({
      service: "full_report",
      requestHash,
      requestPayload: {},
      resultPayload: { verdict: "USE_WITH_CONTEXT" },
      methodologyVersion: "1.0.0",
      marketId: "mkt-789",
      eventId: undefined,
      dataAsOf: new Date(),
      generatedAt: new Date(),
      isPublic: false,
    });

    const found = await repo.findByRequestHash(requestHash);
    expect(found?.publicId).toBe(created.publicId);
  });

  it("returns undefined for an unknown public_id rather than throwing", async () => {
    const result = await repo.findByPublicId("does-not-exist");
    expect(result).toBeUndefined();
  });
});
