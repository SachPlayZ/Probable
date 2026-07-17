import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { computeSignalConfidence, gradeForScore } from "../src/reports/signal-confidence.js";
import { computeVerdict } from "../src/reports/verdict.js";

describe("computeSignalConfidence", () => {
  it("weights market quality most heavily", () => {
    const result = computeSignalConfidence({ marketQuality: 100, resolutionRisk: 0, relatedMarketAgreement: 50 });
    // 0.60*100 + 0.25*50 + 0.15*100 = 60 + 12.5 + 15 = 87.5
    expect(result.score).toBe(87.5);
    expect(result.grade).toBe("HIGH");
  });

  it("uses a neutral 50 for related-market agreement when nothing to compare", () => {
    const withNeutral = computeSignalConfidence({ marketQuality: 50, resolutionRisk: 50, relatedMarketAgreement: 50 });
    const withHigh = computeSignalConfidence({ marketQuality: 50, resolutionRisk: 50, relatedMarketAgreement: 100 });
    expect(withHigh.score).toBeGreaterThan(withNeutral.score);
  });

  it("stays within [0, 100] for any valid input", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (mq, rr, agreement) => {
          const result = computeSignalConfidence({ marketQuality: mq, resolutionRisk: rr, relatedMarketAgreement: agreement });
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(100);
        },
      ),
    );
  });
});

describe("gradeForScore", () => {
  it("maps boundaries correctly", () => {
    expect(gradeForScore(0)).toBe("VERY_LOW");
    expect(gradeForScore(39)).toBe("VERY_LOW");
    expect(gradeForScore(40)).toBe("LOW");
    expect(gradeForScore(59)).toBe("LOW");
    expect(gradeForScore(60)).toBe("MODERATE");
    expect(gradeForScore(79)).toBe("MODERATE");
    expect(gradeForScore(80)).toBe("HIGH");
    expect(gradeForScore(100)).toBe("HIGH");
  });
});

describe("computeVerdict", () => {
  it("rules risk dominates when resolution risk is CRITICAL regardless of quality", () => {
    expect(computeVerdict({ resolutionRisk: 70, marketQuality: 90, highConfidenceContradictionCount: 0 })).toBe(
      "RULES_RISK_DOMINATES",
    );
  });

  it("weak market signal when quality is low, even with clean rules", () => {
    expect(computeVerdict({ resolutionRisk: 0, marketQuality: 34, highConfidenceContradictionCount: 0 })).toBe(
      "WEAK_MARKET_SIGNAL",
    );
  });

  it("related markets disagree when a high-confidence contradiction exists", () => {
    expect(computeVerdict({ resolutionRisk: 10, marketQuality: 50, highConfidenceContradictionCount: 1 })).toBe(
      "RELATED_MARKETS_DISAGREE",
    );
  });

  it("stronger market signal for high quality and low risk with no contradictions", () => {
    expect(computeVerdict({ resolutionRisk: 10, marketQuality: 80, highConfidenceContradictionCount: 0 })).toBe(
      "STRONGER_MARKET_SIGNAL",
    );
  });

  it("falls back to use-with-context otherwise", () => {
    expect(computeVerdict({ resolutionRisk: 50, marketQuality: 50, highConfidenceContradictionCount: 0 })).toBe(
      "USE_WITH_CONTEXT",
    );
  });

  it("respects band precedence: resolution risk check runs before quality/contradiction checks", () => {
    fc.assert(
      fc.property(fc.integer({ min: 70, max: 100 }), fc.integer({ min: 0, max: 100 }), (risk, quality) => {
        const verdict = computeVerdict({ resolutionRisk: risk, marketQuality: quality, highConfidenceContradictionCount: 5 });
        expect(verdict).toBe("RULES_RISK_DOMINATES");
      }),
    );
  });
});
