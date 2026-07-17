import { Decimal } from "decimal.js";
import type { FillResult } from "./simulate-fill.js";

export type ExitDifficulty = "easy" | "moderate" | "hard" | "unknown";

/** PLAN.md §12.3 exit-difficulty thresholds — methodology v1, versioned with the rest of the report. */
export function exitDifficulty(fill: FillResult): ExitDifficulty {
  if (fill.priceImpact === undefined) return "unknown";

  const fillRatio = new Decimal(fill.fillRatio);
  const impactPp = new Decimal(fill.priceImpact).abs().times(100);

  if (fillRatio.gte("0.95") && impactPp.lte(1)) return "easy";
  if (fillRatio.gte("0.90") && impactPp.lte(3)) return "moderate";
  return "hard";
}
