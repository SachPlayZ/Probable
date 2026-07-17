import { Decimal } from "decimal.js";
import {
  activityScore,
  concentrationScore,
  depthScore,
  freshnessScore,
  openInterestScore,
  spreadScore,
} from "./components.js";

export interface QualityScoreInput {
  spread: string;
  twoSidedDepthUsd: string;
  recentVolumeUsd: string;
  openInterestUsd: string;
  latestActivityAgeMs: number;
  topHolderShare: string | undefined;
}

export interface QualityScoreResult {
  score: number;
  components: {
    spread_score: number;
    depth_score: number;
    activity_score: number;
    open_interest_score: number;
    freshness_score: number;
    concentration_score: number;
  };
}

const WEIGHTS = {
  spread: new Decimal("0.25"),
  depth: new Decimal("0.25"),
  activity: new Decimal("0.20"),
  openInterest: new Decimal("0.15"),
  freshness: new Decimal("0.10"),
  concentration: new Decimal("0.05"),
};

/**
 * PLAN.md §12.3 quality_score formula. A transparent heuristic, not a promise of
 * market correctness — every component is returned to the caller (AGENTS.md §6:
 * "a score without exposed components is incomplete").
 */
export function computeQualityScore(input: QualityScoreInput): QualityScoreResult {
  const spread = spreadScore(input.spread);
  const depth = depthScore(input.twoSidedDepthUsd);
  const activity = activityScore(input.recentVolumeUsd);
  const openInterest = openInterestScore(input.openInterestUsd);
  const freshness = freshnessScore(input.latestActivityAgeMs);
  // No holder data is a neutral 50, not a penalty and not a reward.
  const concentration = input.topHolderShare === undefined ? new Decimal(50) : concentrationScore(input.topHolderShare);

  const total = WEIGHTS.spread
    .times(spread)
    .plus(WEIGHTS.depth.times(depth))
    .plus(WEIGHTS.activity.times(activity))
    .plus(WEIGHTS.openInterest.times(openInterest))
    .plus(WEIGHTS.freshness.times(freshness))
    .plus(WEIGHTS.concentration.times(concentration));

  return {
    score: total.toDecimalPlaces(2).toNumber(),
    components: {
      spread_score: spread.toDecimalPlaces(2).toNumber(),
      depth_score: depth.toDecimalPlaces(2).toNumber(),
      activity_score: activity.toDecimalPlaces(2).toNumber(),
      open_interest_score: openInterest.toDecimalPlaces(2).toNumber(),
      freshness_score: freshness.toDecimalPlaces(2).toNumber(),
      concentration_score: concentration.toDecimalPlaces(2).toNumber(),
    },
  };
}
