export type Verdict =
  | "RULES_RISK_DOMINATES"
  | "WEAK_MARKET_SIGNAL"
  | "RELATED_MARKETS_DISAGREE"
  | "STRONGER_MARKET_SIGNAL"
  | "USE_WITH_CONTEXT";

export interface VerdictInput {
  resolutionRisk: number;
  marketQuality: number;
  highConfidenceContradictionCount: number;
}

/**
 * PLAN.md §12.6 — deterministic band logic only. Explanatory prose may be generated
 * from verified fields elsewhere, but the verdict itself is never free-form LLM output.
 */
export function computeVerdict(input: VerdictInput): Verdict {
  if (input.resolutionRisk >= 70) return "RULES_RISK_DOMINATES";
  if (input.marketQuality < 35) return "WEAK_MARKET_SIGNAL";
  if (input.highConfidenceContradictionCount > 0) return "RELATED_MARKETS_DISAGREE";
  if (input.marketQuality >= 70 && input.resolutionRisk < 20) return "STRONGER_MARKET_SIGNAL";
  return "USE_WITH_CONTEXT";
}
