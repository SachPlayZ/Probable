import { Decimal } from "decimal.js";

/**
 * Percentage-point change, not percent change: 40% → 48% is +8pp, not +8%
 * (PLAN.md §12.2 — a release-blocking distinction per AGENTS.md).
 */
export function changePp(currentProbability: string, historicalProbability: string): string {
  const current = new Decimal(currentProbability).times(100);
  const historical = new Decimal(historicalProbability).times(100);
  return current.minus(historical).toString();
}

export function toPercent(probability: string): string {
  return new Decimal(probability).times(100).toString();
}
