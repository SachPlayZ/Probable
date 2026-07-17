import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { simulateMarketOrder, depthWithinBand } from "../src/orderbook/simulate-fill.js";
import { exitDifficulty } from "../src/orderbook/exit-difficulty.js";
import type { OrderBook, OrderBookLevel } from "../src/probability/types.js";

const asks: OrderBookLevel[] = [
  { price: "0.50", size: "100" },
  { price: "0.52", size: "200" },
  { price: "0.55", size: "300" },
];
const bids: OrderBookLevel[] = [
  { price: "0.48", size: "100" },
  { price: "0.46", size: "200" },
  { price: "0.44", size: "300" },
];

describe("simulateMarketOrder — buy", () => {
  it("fills entirely within the first level when small enough", () => {
    const result = simulateMarketOrder(asks, "buy", "10", "0.50");
    expect(result.partialFill).toBe(false);
    expect(result.vwap).toBe("0.5");
    expect(result.fillRatio).toBe("1");
  });

  it("walks multiple levels lowest-price-first and computes blended VWAP", () => {
    // level 1: $50 notional (100 @ 0.50), remaining $30 eats into level 2 (0.52)
    const result = simulateMarketOrder(asks, "buy", "80", "0.50");
    expect(result.partialFill).toBe(false);
    expect(Number(result.vwap)).toBeGreaterThan(0.5);
    expect(Number(result.vwap)).toBeLessThan(0.52);
  });

  it("returns partial_fill when requested size exceeds visible depth, never inventing extra fill", () => {
    const result = simulateMarketOrder(asks, "buy", "100000", "0.50");
    expect(result.partialFill).toBe(true);
    expect(Number(result.fillRatio)).toBeLessThan(1);
  });

  it("returns an explicit empty state (no vwap) for an empty book", () => {
    const result = simulateMarketOrder([], "buy", "100", "0.50");
    expect(result.vwap).toBeUndefined();
    expect(result.priceImpact).toBeUndefined();
    expect(result.fillRatio).toBe("0");
    expect(result.partialFill).toBe(true);
  });

  it("never divides by zero when requested notional is 0", () => {
    const result = simulateMarketOrder(asks, "buy", "0", "0.50");
    expect(result.fillRatio).toBe("0");
  });
});

describe("simulateMarketOrder — sell", () => {
  it("walks bids highest-price-first", () => {
    const result = simulateMarketOrder(bids, "sell", "40", "0.48");
    expect(result.vwap).toBe("0.48");
  });
});

describe("simulateMarketOrder invariants (property-based)", () => {
  it("buy VWAP is never below the lowest consumed ask price", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 500 }), (notional) => {
        const result = simulateMarketOrder(asks, "buy", String(notional), "0.50");
        if (result.vwap !== undefined) {
          expect(Number(result.vwap)).toBeGreaterThanOrEqual(0.5 - 1e-9);
        }
      }),
    );
  });

  it("sell VWAP is never above the highest consumed bid price", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 500 }), (notional) => {
        const result = simulateMarketOrder(bids, "sell", String(notional), "0.48");
        if (result.vwap !== undefined) {
          expect(Number(result.vwap)).toBeLessThanOrEqual(0.48 + 1e-9);
        }
      }),
    );
  });

  it("fill ratio always stays within [0, 1]", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100000 }), (notional) => {
        const result = simulateMarketOrder(asks, "buy", String(notional), "0.50");
        const ratio = Number(result.fillRatio);
        expect(ratio).toBeGreaterThanOrEqual(0);
        expect(ratio).toBeLessThanOrEqual(1);
      }),
    );
  });
});

describe("depthWithinBand", () => {
  it("sums two-sided notional within the configured band", () => {
    const book: OrderBook = { bids, asks };
    const { bidDepthUsd, askDepthUsd } = depthWithinBand(book, "0.49", "0.03");
    expect(Number(bidDepthUsd)).toBeGreaterThan(0);
    expect(Number(askDepthUsd)).toBeGreaterThan(0);
  });
});

describe("exitDifficulty", () => {
  it("labels a near-full, low-impact fill as easy", () => {
    const result = simulateMarketOrder(asks, "buy", "10", "0.50");
    expect(exitDifficulty(result)).toBe("easy");
  });

  it("labels an empty-book result as unknown", () => {
    const result = simulateMarketOrder([], "buy", "10", "0.50");
    expect(exitDifficulty(result)).toBe("unknown");
  });

  it("labels a large partial fill as hard", () => {
    const result = simulateMarketOrder(asks, "buy", "100000", "0.50");
    expect(exitDifficulty(result)).toBe("hard");
  });
});
