import { Decimal } from "decimal.js";

export type ConfidenceGrade = "HIGH" | "MODERATE" | "LOW" | "VERY_LOW";

export interface SignalConfidenceInput {
  marketQuality: number;
  resolutionRisk: number;
  /** 50 (neutral) when no meaningful related markets exist — never inflates the score (PLAN.md §14). */
  relatedMarketAgreement: number;
}

export interface SignalConfidenceResult {
  score: number;
  grade: ConfidenceGrade;
}

const WEIGHTS = {
  marketQuality: new Decimal("0.60"),
  relatedMarketAgreement: new Decimal("0.25"),
  resolutionClarity: new Decimal("0.15"),
};

export function gradeForScore(score: number): ConfidenceGrade {
  if (score >= 80) return "HIGH";
  if (score >= 60) return "MODERATE";
  if (score >= 40) return "LOW";
  return "VERY_LOW";
}

/**
 * PLAN.md §14 — measures confidence in the *market signal quality*, not certainty
 * of the real-world outcome. Every caller must attach the fixed disclaimer sentence.
 */
export function computeSignalConfidence(input: SignalConfidenceInput): SignalConfidenceResult {
  const resolutionClarity = new Decimal(100).minus(input.resolutionRisk);
  const total = WEIGHTS.marketQuality
    .times(input.marketQuality)
    .plus(WEIGHTS.relatedMarketAgreement.times(input.relatedMarketAgreement))
    .plus(WEIGHTS.resolutionClarity.times(resolutionClarity));

  const score = total.toDecimalPlaces(2).toNumber();
  return { score, grade: gradeForScore(score) };
}

export const SIGNAL_CONFIDENCE_DISCLAIMER =
  "Signal confidence measures the quality and clarity of the market signal; it does not measure certainty of the real-world outcome.";
