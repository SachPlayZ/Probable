import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { multiOutcomeSumCheck } from "../src/contradictions/multi-outcome-sum.js";
import { findNearDuplicates, type CandidateMarket } from "../src/contradictions/near-duplicate.js";

describe("multiOutcomeSumCheck", () => {
  it("does not flag a well-priced exhaustive set summing near 1", () => {
    const result = multiOutcomeSumCheck(["0.3", "0.3", "0.39"], ["0.01", "0.01", "0.01"]);
    expect(result.flagged).toBe(false);
  });

  it("flags a sum that clears the buffer", () => {
    const result = multiOutcomeSumCheck(["0.4", "0.4", "0.4"], ["0.01", "0.01", "0.01"]);
    // sum = 1.2, raw_excess = 0.2, buffer = 0.03 + 0.015 = 0.045 -> flagged
    expect(result.flagged).toBe(true);
    expect(result.rawExcess).toBe("0.2");
  });

  it("does not flag a small excess within the buffer (never a bare raw_excess > 0)", () => {
    const result = multiOutcomeSumCheck(["0.34", "0.34", "0.34"], ["0.02", "0.02", "0.02"]);
    // sum = 1.02, raw_excess = 0.02, buffer = 0.03 + 0.03 = 0.06 -> not flagged
    expect(result.flagged).toBe(false);
  });

  it("returns an empty list rather than manufacturing a finding when nothing is flagged", () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: Math.fround(0.1), max: Math.fround(0.3), noNaN: true }), { minLength: 2, maxLength: 5 }),
        (midpoints) => {
          const strs = midpoints.map((m) => m.toString());
          const spreads = strs.map(() => "0.01");
          const result = multiOutcomeSumCheck(strs, spreads);
          if (Number(result.sumMidpoints) < 0.9) {
            expect(result.flagged).toBe(false);
          }
        },
      ),
    );
  });
});

describe("findNearDuplicates", () => {
  const base: CandidateMarket = {
    marketId: "a",
    question: "Will Bitcoin reach $100,000 by end of 2026?",
    endDate: "2026-12-31T23:59:59Z",
    midpoint: "0.4",
  };

  it("flags two near-identical questions with the same deadline and a real price gap", () => {
    const markets: CandidateMarket[] = [
      base,
      { marketId: "b", question: "Will Bitcoin reach $100,000 by end of 2026?", endDate: base.endDate, midpoint: "0.55" },
    ];
    const pairs = findNearDuplicates(markets, "3");
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.discrepancyPp).toBe("15");
  });

  it("never compares markets with different deadlines", () => {
    const markets: CandidateMarket[] = [
      base,
      { marketId: "b", question: base.question, endDate: "2027-01-01T00:00:00Z", midpoint: "0.9" },
    ];
    expect(findNearDuplicates(markets, "3")).toHaveLength(0);
  });

  it("ignores unrelated questions even with a large price gap", () => {
    const markets: CandidateMarket[] = [
      base,
      { marketId: "b", question: "Will the Fed cut rates in 2026?", endDate: base.endDate, midpoint: "0.9" },
    ];
    expect(findNearDuplicates(markets, "3")).toHaveLength(0);
  });

  it("does not flag a discrepancy below the minimum edge buffer", () => {
    const markets: CandidateMarket[] = [
      base,
      { marketId: "b", question: base.question, endDate: base.endDate, midpoint: "0.41" },
    ];
    expect(findNearDuplicates(markets, "3")).toHaveLength(0);
  });
});
