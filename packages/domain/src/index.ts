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
