import { Decimal } from "decimal.js";
import type { OrderBook, OrderBookLevel } from "./types.js";

export interface BookTop {
  bestBid: Decimal | undefined;
  bestAsk: Decimal | undefined;
}

function bestOf(levels: OrderBookLevel[], pick: "max" | "min"): Decimal | undefined {
  if (levels.length === 0) return undefined;
  let best: Decimal | undefined;
  for (const level of levels) {
    const price = new Decimal(level.price);
    if (best === undefined) {
      best = price;
      continue;
    }
    if (pick === "max" ? price.gt(best) : price.lt(best)) {
      best = price;
    }
  }
  return best;
}

/**
 * Best bid = highest bid price, best ask = lowest ask price — computed defensively
 * rather than assumed from upstream array order (Polymarket does not guarantee sort order).
 */
export function bookTop(book: OrderBook): BookTop {
  return {
    bestBid: bestOf(book.bids, "max"),
    bestAsk: bestOf(book.asks, "min"),
  };
}

export interface SpreadResult {
  midpoint: Decimal;
  spread: Decimal;
  spreadBps: Decimal;
}

/**
 * Requires both sides present — an empty or one-sided book must produce an explicit
 * absent state upstream, never an invented midpoint (AGENTS.md §8 invariants).
 */
export function computeSpread(bestBid: Decimal, bestAsk: Decimal): SpreadResult {
  const midpoint = bestBid.plus(bestAsk).div(2);
  const spread = bestAsk.minus(bestBid);
  const spreadBps = spread.times(10_000);
  return { midpoint, spread, spreadBps };
}
