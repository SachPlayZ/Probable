import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { bandForScore, computeResolutionRisk, scoreForMissingResolutionText } from "../src/resolution-risk/scoring.js";
import { evidenceExistsIn, verifyFindingsEvidence } from "../src/resolution-risk/evidence.js";
import type { ResolutionFinding } from "../src/resolution-risk/types.js";

function finding(overrides: Partial<ResolutionFinding> = {}): ResolutionFinding {
  return {
    type: "undefined_term",
    severity: "medium",
    evidence: "the winner",
    explanation: "not defined",
    possible_interpretations: [],
    ...overrides,
  };
}

describe("computeResolutionRisk", () => {
  it("returns 0/LOW for no findings", () => {
    const result = computeResolutionRisk([]);
    expect(result.score).toBe(0);
    expect(result.band).toBe("LOW");
  });

  it("weights missing_resolution_source at 25", () => {
    const result = computeResolutionRisk([finding({ type: "missing_resolution_source" })]);
    expect(result.score).toBe(25);
    expect(result.band).toBe("MEDIUM");
  });

  it("caps the total score at 100 (CRITICAL)", () => {
    const findings = Array.from({ length: 10 }, () => finding({ type: "missing_resolution_source" }));
    const result = computeResolutionRisk(findings);
    expect(result.score).toBe(100);
    expect(result.band).toBe("CRITICAL");
  });

  it("scores 'other' findings by severity, not a fixed weight", () => {
    const low = computeResolutionRisk([finding({ type: "other", severity: "low" })]);
    const high = computeResolutionRisk([finding({ type: "other", severity: "high" })]);
    expect(low.score).toBe(3);
    expect(high.score).toBe(12);
  });

  it("missing resolution text produces a deterministic non-zero floor", () => {
    const result = scoreForMissingResolutionText();
    expect(result.score).toBeGreaterThan(0);
  });

  it("score always stays within [0, 100] for any finding set", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30 }), (count) => {
        const findings = Array.from({ length: count }, () => finding({ type: "missing_resolution_source" }));
        const result = computeResolutionRisk(findings);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }),
    );
  });
});

describe("bandForScore", () => {
  it("maps boundary scores to the correct band", () => {
    expect(bandForScore(0)).toBe("LOW");
    expect(bandForScore(19)).toBe("LOW");
    expect(bandForScore(20)).toBe("MEDIUM");
    expect(bandForScore(39)).toBe("MEDIUM");
    expect(bandForScore(40)).toBe("HIGH");
    expect(bandForScore(69)).toBe("HIGH");
    expect(bandForScore(70)).toBe("CRITICAL");
    expect(bandForScore(100)).toBe("CRITICAL");
  });
});

describe("evidence verification", () => {
  const sourceText = "This market resolves YES if the winner is announced before noon ET.";

  it("verifies an exact substring match", () => {
    expect(evidenceExistsIn(sourceText, "the winner is announced")).toBe(true);
  });

  it("rejects a paraphrase that isn't an exact span", () => {
    expect(evidenceExistsIn(sourceText, "winner gets announced")).toBe(false);
  });

  it("rejects empty evidence rather than treating it as vacuously true", () => {
    expect(evidenceExistsIn(sourceText, "")).toBe(false);
  });

  it("drops findings whose evidence can't be located, keeps the rest", () => {
    const findings = [
      finding({ evidence: "the winner is announced" }),
      finding({ evidence: "this text does not appear anywhere" }),
    ];
    const { verified, dropped } = verifyFindingsEvidence(findings, sourceText);
    expect(verified).toHaveLength(1);
    expect(dropped).toHaveLength(1);
  });
});
