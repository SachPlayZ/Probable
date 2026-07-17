export interface OrderBookLevel {
  price: string;
  size: string;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export type PricingMethod = "orderbook_midpoint" | "last_trade" | "gamma_outcome_price";

export interface PriceSelectionInput {
  book?: OrderBook | undefined;
  lastTradePrice?: string | undefined;
  lastTradeAgeMs?: number | undefined;
  gammaOutcomePrice?: string | undefined;
}

export interface PriceSelectionResult {
  /** Selected probability on [0, 1], as a decimal string — never a JS float. */
  price: string;
  method: PricingMethod;
  bestBid?: string;
  bestAsk?: string;
  spread?: string;
  spreadBps?: string;
  warnings: string[];
}

/** Max age for a last-trade fallback to count as "recent" (PLAN.md §12.2 hierarchy step 2). */
export const LAST_TRADE_MAX_AGE_MS = 10 * 60 * 1000;
