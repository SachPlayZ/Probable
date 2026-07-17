import { Decimal } from "decimal.js";
import type { FindingSeverity, FindingType, ResolutionFinding, RiskBand } from "./types.js";

/**
 * PLAN.md §12.4 methodology v1 weights. "conflicting_rule" isn't its own row in the
 * plan's table — folded into the "ambiguous or conflicting deadline" weight since
 * that's the only "conflicting" category named; a future methodology version can
 * split it out with its own weight and a version bump.
 */
const FIXED_WEIGHTS: Partial<Record<FindingType, number>> = {
  missing_resolution_source: 25,
  ambiguous_deadline: 20,
  conflicting_rule: 20,
  timezone_missing: 5,
  undefined_term: 15,
  subjective_verb: 15,
  question_description_mismatch: 20,
  non_exhaustive_outcomes: 15,
  overlapping_outcomes: 15,
  edge_case_missing: 10,
};

const OTHER_SEVERITY_WEIGHTS: Record<FindingSeverity, number> = {
  low: 3,
  medium: 7,
  high: 12,
};

function findingWeight(finding: ResolutionFinding): number {
  if (finding.type === "other") return OTHER_SEVERITY_WEIGHTS[finding.severity];
  return FIXED_WEIGHTS[finding.type] ?? OTHER_SEVERITY_WEIGHTS[finding.severity];
}

export interface RiskScoreResult {
  score: number;
  band: RiskBand;
}

export function bandForScore(score: number): RiskBand {
  if (score < 20) return "LOW";
  if (score < 40) return "MEDIUM";
  if (score < 70) return "HIGH";
  return "CRITICAL";
}

/** Deterministic — the LLM supplies findings only, never the score (AGENTS.md §11). */
export function computeResolutionRisk(findings: ResolutionFinding[]): RiskScoreResult {
  const total = findings.reduce((sum, f) => sum.plus(findingWeight(f)), new Decimal(0));
  const capped = Decimal.min(total, 100).toNumber();
  return { score: capped, band: bandForScore(capped) };
}

/** Missing-data deterministic floor when no resolution text was supplied at all. */
export function scoreForMissingResolutionText(): RiskScoreResult {
  return computeResolutionRisk([
    {
      type: "missing_resolution_source",
      severity: "high",
      evidence: "",
      explanation: "No resolution source text was available to audit.",
      possible_interpretations: [],
    },
  ]);
}
