import { Decimal } from "decimal.js";
import type { OrderBook, OrderBookLevel } from "../probability/types.js";

export type OrderSide = "buy" | "sell";

export interface FillResult {
  requestedNotional: string;
  filledNotional: string;
  filledQuantity: string;
  /** Undefined when nothing could be filled at all (empty book on the consumed side). */
  vwap: string | undefined;
  priceImpact: string | undefined;
  fillRatio: string;
  partialFill: boolean;
}

function sortForConsumption(levels: OrderBookLevel[], side: OrderSide): OrderBookLevel[] {
  const withDecimal = levels.map((l) => ({ price: new Decimal(l.price), size: new Decimal(l.size) }));
  // Buy consumes asks lowest-first; sell consumes bids highest-first.
  withDecimal.sort((a, b) => (side === "buy" ? a.price.cmp(b.price) : b.price.cmp(a.price)));
  return withDecimal.map((l) => ({ price: l.price.toString(), size: l.size.toString() }));
}

/**
 * PLAN.md §12.3 order-book simulation. Never extrapolates beyond visible levels —
 * a request larger than visible depth returns `partialFill: true` with the honest
 * filled amount, never an invented full fill.
 */
export function simulateMarketOrder(
  levels: OrderBookLevel[],
  side: OrderSide,
  requestedNotionalUsd: string,
  referencePrice: string,
): FillResult {
  const requested = new Decimal(requestedNotionalUsd);
  const reference = new Decimal(referencePrice);
  const ordered = sortForConsumption(levels, side);

  let remaining = requested;
  let filledQuantity = new Decimal(0);
  let filledNotional = new Decimal(0);

  for (const level of ordered) {
    if (remaining.lte(0)) break;
    const price = new Decimal(level.price);
    const size = new Decimal(level.size);
    if (price.lte(0)) continue;

    const levelNotional = price.times(size);

    if (remaining.gte(levelNotional)) {
      filledQuantity = filledQuantity.plus(size);
      filledNotional = filledNotional.plus(levelNotional);
      remaining = remaining.minus(levelNotional);
    } else {
      const partialQty = remaining.div(price);
      filledQuantity = filledQuantity.plus(partialQty);
      filledNotional = filledNotional.plus(remaining);
      remaining = new Decimal(0);
    }
  }

  const vwap = filledQuantity.gt(0) ? filledNotional.div(filledQuantity) : undefined;
  const priceImpact = vwap ? (side === "buy" ? vwap.minus(reference) : reference.minus(vwap)) : undefined;
  const fillRatio = requested.gt(0) ? filledNotional.div(requested) : new Decimal(0);

  return {
    requestedNotional: requested.toString(),
    filledNotional: filledNotional.toString(),
    filledQuantity: filledQuantity.toString(),
    vwap: vwap?.toString(),
    priceImpact: priceImpact?.toString(),
    fillRatio: fillRatio.toString(),
    partialFill: remaining.gt(0),
  };
}

/** Two-sided notional depth within `referencePrice ± band` — never a substitute for live simulation. */
export function depthWithinBand(book: OrderBook, referencePrice: string, band: string): { bidDepthUsd: string; askDepthUsd: string } {
  const reference = new Decimal(referencePrice);
  const bandDecimal = new Decimal(band);
  const lowerBound = reference.minus(bandDecimal);
  const upperBound = reference.plus(bandDecimal);

  const bidDepthUsd = book.bids.reduce((sum, level) => {
    const price = new Decimal(level.price);
    if (price.gte(lowerBound) && price.lte(reference)) {
      return sum.plus(price.times(level.size));
    }
    return sum;
  }, new Decimal(0));

  const askDepthUsd = book.asks.reduce((sum, level) => {
    const price = new Decimal(level.price);
    if (price.lte(upperBound) && price.gte(reference)) {
      return sum.plus(price.times(level.size));
    }
    return sum;
  }, new Decimal(0));

  return { bidDepthUsd: bidDepthUsd.toString(), askDepthUsd: askDepthUsd.toString() };
}
