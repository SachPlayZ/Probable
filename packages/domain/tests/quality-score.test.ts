import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { computeQualityScore } from "../src/market-quality/quality-score.js";

describe("computeQualityScore", () => {
  it("scores a tight, deep, active, fresh market highly", () => {
    const result = computeQualityScore({
      spread: "0.005",
      twoSidedDepthUsd: "1000000",
      recentVolumeUsd: "500000",
      openInterestUsd: "2000000",
      latestActivityAgeMs: 60_000,
      topHolderShare: "0.05",
    });
    expect(result.score).toBeGreaterThan(70);
    expect(result.components.spread_score).toBeGreaterThan(90);
  });

  it("scores a wide-spread, illiquid, stale market low", () => {
    const result = computeQualityScore({
      spread: "0.15",
      twoSidedDepthUsd: "0",
      recentVolumeUsd: "0",
      openInterestUsd: "0",
      latestActivityAgeMs: 30 * 24 * 60 * 60 * 1000,
      topHolderShare: "0.9",
    });
    expect(result.score).toBeLessThan(15);
  });

  it("treats missing holder data as neutral (50), not a penalty", () => {
    const withHolder = computeQualityScore({
      spread: "0.02",
      twoSidedDepthUsd: "10000",
      recentVolumeUsd: "10000",
      openInterestUsd: "10000",
      latestActivityAgeMs: 60_000,
      topHolderShare: "0.5",
    });
    const withoutHolder = computeQualityScore({
      spread: "0.02",
      twoSidedDepthUsd: "10000",
      recentVolumeUsd: "10000",
      openInterestUsd: "10000",
      latestActivityAgeMs: 60_000,
      topHolderShare: undefined,
    });
    expect(withHolder.components.concentration_score).toBe(50);
    expect(withoutHolder.components.concentration_score).toBe(50);
  });

  it("stays within [0, 100] and every component stays within [0, 100] for any input", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(0.5), noNaN: true }),
        fc.float({ min: 0, max: Math.fround(1e9), noNaN: true }),
        fc.float({ min: 0, max: Math.fround(1e9), noNaN: true }),
        fc.float({ min: 0, max: Math.fround(1e9), noNaN: true }),
        (spread, depth, volume, oi) => {
          const result = computeQualityScore({
            spread: spread.toString(),
            twoSidedDepthUsd: depth.toString(),
            recentVolumeUsd: volume.toString(),
            openInterestUsd: oi.toString(),
            latestActivityAgeMs: 0,
            topHolderShare: "0.1",
          });
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(100);
          for (const v of Object.values(result.components)) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(100);
          }
        },
      ),
    );
  });
});
