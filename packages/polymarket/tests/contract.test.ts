import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gammaMarketsResponseSchema, gammaPublicSearchResponseSchema } from "../src/schemas/gamma.schema.js";
import { clobBookSchema } from "../src/schemas/clob.schema.js";
import { normalizeGammaMarket } from "../src/normalize.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), "utf-8"));
}

describe("Gamma contract fixtures", () => {
  it("parses a real /markets response and normalizes it", () => {
    const raw = loadFixture("gamma-market.json");
    const markets = gammaMarketsResponseSchema.parse(raw);
    expect(markets.length).toBeGreaterThan(0);

    const normalized = normalizeGammaMarket(markets[0]!);
    expect(normalized.marketId).toBe("2758332");
    expect(normalized.outcomes).toHaveLength(2);
    expect(normalized.outcomes[0]?.name).toBe("Yes");
    expect(normalized.enableOrderBook).toBe(true);
  });

  it("parses a real /public-search response", () => {
    const raw = loadFixture("gamma-public-search.json");
    const parsed = gammaPublicSearchResponseSchema.parse(raw);
    expect(parsed.events.length).toBeGreaterThan(0);
  });

  it("tolerates a real public-search market missing outcomePrices/enableOrderBook", () => {
    const raw = loadFixture("gamma-market-missing-fields.json");
    const markets = gammaMarketsResponseSchema.parse(raw);
    expect(markets).toHaveLength(2);

    const [missingEnableOrderBook, missingOutcomePrices] = markets;
    expect(missingEnableOrderBook?.enableOrderBook).toBeUndefined();
    expect(missingOutcomePrices?.outcomePrices).toBeUndefined();

    // Normalization must read absence as "unknown", never invent a price or assume tradable.
    const normalized = normalizeGammaMarket(missingEnableOrderBook!);
    expect(normalized.enableOrderBook).toBe(false);
    const normalized2 = normalizeGammaMarket(missingOutcomePrices!);
    expect(normalized2.outcomes.every((o) => o.gammaPrice === undefined)).toBe(true);
  });

  it("fails loudly when a required field goes missing (schema-drift guard)", () => {
    const raw = loadFixture("gamma-market.json") as unknown[];
    const broken = (raw as Record<string, unknown>[]).map((m) => {
      const { question: _question, ...rest } = m;
      return rest;
    });
    expect(() => gammaMarketsResponseSchema.parse(broken)).toThrow();
  });
});

describe("CLOB contract fixtures", () => {
  it("parses a real /book response", () => {
    const raw = loadFixture("clob-book.json");
    const book = clobBookSchema.parse(raw);
    expect(book.bids.length).toBeGreaterThan(0);
    expect(book.asks.length).toBeGreaterThan(0);
    for (const level of [...book.bids, ...book.asks]) {
      expect(Number.isNaN(Number(level.price))).toBe(false);
    }
  });
});
