import { Decimal } from "decimal.js";

function clamp0to100(value: Decimal): Decimal {
  if (value.lt(0)) return new Decimal(0);
  if (value.gt(100)) return new Decimal(100);
  return value;
}

/** PLAN.md §12.3 methodology v1 component mappings. Thresholds are versioned here. */

export function spreadScore(spread: string): Decimal {
  // clamp(100 x (1 - spread / 0.10), 0, 100) — a 10pp-wide spread scores 0.
  const s = new Decimal(spread);
  return clamp0to100(new Decimal(100).times(new Decimal(1).minus(s.div("0.10"))));
}

function log10Score(value: string, coefficient: string): Decimal {
  const v = new Decimal(value);
  const base = v.lt(0) ? new Decimal(0) : v;
  return clamp0to100(new Decimal(coefficient).times(base.plus(1).log(10)));
}

export function depthScore(twoSidedDepthUsd: string): Decimal {
  return log10Score(twoSidedDepthUsd, "25");
}

export function activityScore(recentVolumeUsd: string): Decimal {
  return log10Score(recentVolumeUsd, "20");
}

export function openInterestScore(openInterestUsd: string): Decimal {
  return log10Score(openInterestUsd, "20");
}

/** Freshness buckets by age of the latest trade/update — methodology v1. */
export function freshnessScore(ageMs: number): Decimal {
  const hour = 60 * 60 * 1000;
  if (ageMs <= hour) return new Decimal(100);
  if (ageMs <= 6 * hour) return new Decimal(80);
  if (ageMs <= 24 * hour) return new Decimal(60);
  if (ageMs <= 7 * 24 * hour) return new Decimal(30);
  return new Decimal(0);
}

export function concentrationScore(topHolderShare: string): Decimal {
  // clamp(100 x (1 - top_holder_share), 0, 100) — top_holder_share on [0, 1].
  const share = new Decimal(topHolderShare);
  return clamp0to100(new Decimal(100).times(new Decimal(1).minus(share)));
}
