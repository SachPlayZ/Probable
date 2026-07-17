import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { selectPrice } from "../src/probability/price-selection.js";
import type { OrderBook } from "../src/probability/types.js";

describe("selectPrice hierarchy", () => {
  it("prefers order book midpoint when both sides exist", () => {
    const book: OrderBook = { bids: [{ price: "0.4", size: "1" }], asks: [{ price: "0.5", size: "1" }] };
    const result = selectPrice({ book, lastTradePrice: "0.9", gammaOutcomePrice: "0.1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.method).toBe("orderbook_midpoint");
      expect(result.price).toBe("0.45");
    }
  });

  it("falls back to recent last trade when book is one-sided", () => {
    const book: OrderBook = { bids: [], asks: [{ price: "0.5", size: "1" }] };
    const result = selectPrice({ book, lastTradePrice: "0.62", lastTradeAgeMs: 1000 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.method).toBe("last_trade");
      expect(result.price).toBe("0.62");
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });

  it("skips a stale last trade and falls back to Gamma outcome price", () => {
    const result = selectPrice({
      lastTradePrice: "0.62",
      lastTradeAgeMs: 999_999_999,
      gammaOutcomePrice: "0.7",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.method).toBe("gamma_outcome_price");
      expect(result.price).toBe("0.7");
    }
  });

  it("returns insufficient_market_data rather than inventing a price", () => {
    const result = selectPrice({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("insufficient_market_data");
  });

  it("returns insufficient_market_data for a fully empty book with no fallback", () => {
    const result = selectPrice({ book: { bids: [], asks: [] } });
    expect(result.ok).toBe(false);
  });
});

describe("selectPrice invariants (property-based)", () => {
  it("selected price always stays within [0, 1] for any valid two-sided book", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
        fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
        (bid, ask) => {
          const [lo, hi] = bid <= ask ? [bid, ask] : [ask, bid];
          const book: OrderBook = {
            bids: [{ price: lo.toString(), size: "1" }],
            asks: [{ price: hi.toString(), size: "1" }],
          };
          const result = selectPrice({ book });
          if (result.ok) {
            const price = Number(result.price);
            expect(price).toBeGreaterThanOrEqual(0);
            expect(price).toBeLessThanOrEqual(1);
          }
        },
      ),
    );
  });

  it("spread_bps is always non-negative when both sides present", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
        fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
        (a, b) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          const book: OrderBook = {
            bids: [{ price: lo.toString(), size: "1" }],
            asks: [{ price: hi.toString(), size: "1" }],
          };
          const result = selectPrice({ book });
          if (result.ok && result.method === "orderbook_midpoint") {
            expect(Number(result.spreadBps)).toBeGreaterThanOrEqual(0);
          }
        },
      ),
    );
  });
});
