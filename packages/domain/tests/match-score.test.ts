import { describe, expect, it } from "vitest";
import { computeMatchScore, recencyScoreFromUpdatedAt } from "../src/search/match-score.js";
import { tokenOverlapScore } from "../src/search/token-overlap.js";

describe("computeMatchScore", () => {
  it("scores a perfect active orderbook-enabled fresh liquid match near 100", () => {
    const score = computeMatchScore({
      semanticSimilarity: 100,
      titleTokenOverlap: 100,
      activeStatus: true,
      orderbookEnabled: true,
      recencyScore: 100,
      liquidityPresent: true,
    });
    expect(score).toBe(100);
  });

  it("scores a closed, illiquid, no-orderbook stale mismatch at 0", () => {
    const score = computeMatchScore({
      semanticSimilarity: 0,
      titleTokenOverlap: 0,
      activeStatus: false,
      orderbookEnabled: false,
      recencyScore: 0,
      liquidityPresent: false,
    });
    expect(score).toBe(0);
  });

  it("stays within [0, 100] for any component mix", () => {
    const score = computeMatchScore({
      semanticSimilarity: 50,
      titleTokenOverlap: 50,
      activeStatus: true,
      orderbookEnabled: false,
      recencyScore: 50,
      liquidityPresent: false,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("tokenOverlapScore", () => {
  it("scores identical titles at 100", () => {
    expect(tokenOverlapScore("Will the Fed cut rates?", "Will the Fed cut rates?")).toBe(100);
  });

  it("scores unrelated titles low", () => {
    expect(tokenOverlapScore("Will the Fed cut rates?", "Bitcoin price prediction")).toBeLessThan(20);
  });

  it("handles empty strings without dividing by zero", () => {
    expect(tokenOverlapScore("", "anything")).toBe(0);
  });
});

describe("recencyScoreFromUpdatedAt", () => {
  it("scores a just-updated market at 100", () => {
    const now = Date.parse("2026-07-17T00:00:00Z");
    expect(recencyScoreFromUpdatedAt("2026-07-17T00:00:00Z", now)).toBe(100);
  });

  it("decays over time and never goes negative", () => {
    const now = Date.parse("2026-07-17T00:00:00Z");
    expect(recencyScoreFromUpdatedAt("2025-01-01T00:00:00Z", now)).toBe(0);
  });

  it("returns 0 for missing/invalid timestamps rather than throwing", () => {
    expect(recencyScoreFromUpdatedAt(undefined, Date.now())).toBe(0);
    expect(recencyScoreFromUpdatedAt("not-a-date", Date.now())).toBe(0);
  });
});
