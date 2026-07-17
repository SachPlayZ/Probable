import { Decimal } from "decimal.js";

export interface MatchScoreInput {
  /**
   * Lexical stand-in for semantic similarity in methodology v1 — an LLM reranker is
   * a later, optional enhancement (PLAN.md §12.1 allows either).
   */
  semanticSimilarity: number;
  titleTokenOverlap: number;
  activeStatus: boolean;
  orderbookEnabled: boolean;
  recencyScore: number;
  liquidityPresent: boolean;
}

const WEIGHTS = {
  semanticSimilarity: new Decimal("0.35"),
  titleTokenOverlap: new Decimal("0.25"),
  activeStatus: new Decimal("0.15"),
  orderbookEnabled: new Decimal("0.10"),
  recency: new Decimal("0.10"),
  liquidityPresence: new Decimal("0.05"),
};

function clamp0to100(value: Decimal): Decimal {
  if (value.lt(0)) return new Decimal(0);
  if (value.gt(100)) return new Decimal(100);
  return value;
}

/** PLAN.md §12.1 match_score formula — Decimal.js throughout, never a JS float score. */
export function computeMatchScore(input: MatchScoreInput): number {
  const score = WEIGHTS.semanticSimilarity
    .times(clamp0to100(new Decimal(input.semanticSimilarity)))
    .plus(WEIGHTS.titleTokenOverlap.times(clamp0to100(new Decimal(input.titleTokenOverlap))))
    .plus(WEIGHTS.activeStatus.times(input.activeStatus ? 100 : 0))
    .plus(WEIGHTS.orderbookEnabled.times(input.orderbookEnabled ? 100 : 0))
    .plus(WEIGHTS.recency.times(clamp0to100(new Decimal(input.recencyScore))))
    .plus(WEIGHTS.liquidityPresence.times(input.liquidityPresent ? 100 : 0));

  return clamp0to100(score).toDecimalPlaces(2).toNumber();
}

/** Recency bucketed by days since the market's last update — no floats, day math only. */
export function recencyScoreFromUpdatedAt(updatedAtIso: string | undefined, nowMs: number): number {
  if (!updatedAtIso) return 0;
  const updatedMs = Date.parse(updatedAtIso);
  if (Number.isNaN(updatedMs)) return 0;
  const daysSince = Math.max(0, Math.floor((nowMs - updatedMs) / (1000 * 60 * 60 * 24)));
  return Math.max(0, 100 - daysSince * 5);
}
