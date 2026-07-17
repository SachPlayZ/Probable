import { Decimal } from "decimal.js";
import { bookTop, computeSpread } from "./book-metrics.js";
import { LAST_TRADE_MAX_AGE_MS, type PriceSelectionInput, type PriceSelectionResult } from "./types.js";

export type PriceSelectionOutcome =
  | ({ ok: true } & PriceSelectionResult)
  | { ok: false; reason: "insufficient_market_data" };

/**
 * PLAN.md §12.2 price-selection hierarchy:
 * 1. book midpoint (both sides present) → highest confidence
 * 2. recent last trade → lower confidence, explicitly labeled
 * 3. Gamma outcome price → lowest confidence, explicitly labeled
 * 4. nothing defensible → insufficient_market_data (never fabricated)
 */
export function selectPrice(input: PriceSelectionInput): PriceSelectionOutcome {
  if (input.book) {
    const { bestBid, bestAsk } = bookTop(input.book);
    if (bestBid && bestAsk) {
      const { midpoint, spread, spreadBps } = computeSpread(bestBid, bestAsk);
      assertUnitInterval(midpoint);
      return {
        ok: true,
        price: midpoint.toString(),
        method: "orderbook_midpoint",
        bestBid: bestBid.toString(),
        bestAsk: bestAsk.toString(),
        spread: spread.toString(),
        spreadBps: spreadBps.toString(),
        warnings: [],
      };
    }
  }

  if (input.lastTradePrice !== undefined) {
    const isRecent = input.lastTradeAgeMs === undefined || input.lastTradeAgeMs <= LAST_TRADE_MAX_AGE_MS;
    if (isRecent) {
      const price = new Decimal(input.lastTradePrice);
      assertUnitInterval(price);
      return {
        ok: true,
        price: price.toString(),
        method: "last_trade",
        warnings: [
          "Order book is empty or one-sided; price derived from the last trade, not a live two-sided market.",
        ],
      };
    }
  }

  if (input.gammaOutcomePrice !== undefined) {
    const price = new Decimal(input.gammaOutcomePrice);
    assertUnitInterval(price);
    return {
      ok: true,
      price: price.toString(),
      method: "gamma_outcome_price",
      warnings: [
        "No live order book or recent trade available; price derived from Gamma's outcome price snapshot.",
      ],
    };
  }

  return { ok: false, reason: "insufficient_market_data" };
}

function assertUnitInterval(value: Decimal): void {
  if (value.lt(0) || value.gt(1)) {
    throw new Error(`probability out of [0,1] bounds: ${value.toString()}`);
  }
}
