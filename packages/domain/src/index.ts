export { bookTop, computeSpread } from "./probability/book-metrics.js";
export type { BookTop, SpreadResult } from "./probability/book-metrics.js";

export { selectPrice } from "./probability/price-selection.js";
export type { PriceSelectionOutcome } from "./probability/price-selection.js";

export { changePp, toPercent } from "./probability/change.js";

export type {
  OrderBook,
  OrderBookLevel,
  PricingMethod,
  PriceSelectionInput,
  PriceSelectionResult,
} from "./probability/types.js";
export { LAST_TRADE_MAX_AGE_MS } from "./probability/types.js";

export { tokenOverlapScore } from "./search/token-overlap.js";
export { computeMatchScore, recencyScoreFromUpdatedAt } from "./search/match-score.js";
export type { MatchScoreInput } from "./search/match-score.js";

export { simulateMarketOrder, depthWithinBand } from "./orderbook/simulate-fill.js";
export type { FillResult, OrderSide } from "./orderbook/simulate-fill.js";
export { exitDifficulty } from "./orderbook/exit-difficulty.js";
export type { ExitDifficulty } from "./orderbook/exit-difficulty.js";

export { computeQualityScore } from "./market-quality/quality-score.js";
export type { QualityScoreInput, QualityScoreResult } from "./market-quality/quality-score.js";

export { FINDING_TYPES, FINDING_SEVERITIES } from "./resolution-risk/types.js";
export type { FindingType, FindingSeverity, ResolutionFinding, RiskBand } from "./resolution-risk/types.js";
export { computeResolutionRisk, scoreForMissingResolutionText, bandForScore } from "./resolution-risk/scoring.js";
export type { RiskScoreResult } from "./resolution-risk/scoring.js";
export { evidenceExistsIn, verifyFindingsEvidence } from "./resolution-risk/evidence.js";
export type { EvidenceVerification } from "./resolution-risk/evidence.js";

export { multiOutcomeSumCheck } from "./contradictions/multi-outcome-sum.js";
export type { MultiOutcomeSumResult } from "./contradictions/multi-outcome-sum.js";
export { findNearDuplicates } from "./contradictions/near-duplicate.js";
export type { CandidateMarket, NearDuplicatePair } from "./contradictions/near-duplicate.js";

export { computeSignalConfidence, gradeForScore, SIGNAL_CONFIDENCE_DISCLAIMER } from "./reports/signal-confidence.js";
export type { ConfidenceGrade, SignalConfidenceInput, SignalConfidenceResult } from "./reports/signal-confidence.js";
export { computeVerdict } from "./reports/verdict.js";
export type { Verdict, VerdictInput } from "./reports/verdict.js";
