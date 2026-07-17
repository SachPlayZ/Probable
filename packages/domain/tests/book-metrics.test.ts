import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";
import { bookTop, computeSpread } from "../src/probability/book-metrics.js";
import type { OrderBook } from "../src/probability/types.js";

describe("bookTop", () => {
  it("finds best bid (max) and best ask (min) regardless of array order", () => {
    const book: OrderBook = {
      bids: [{ price: "0.01", size: "10" }, { price: "0.5", size: "5" }, { price: "0.3", size: "1" }],
      asks: [{ price: "0.99", size: "10" }, { price: "0.55", size: "5" }, { price: "0.7", size: "1" }],
    };
    const { bestBid, bestAsk } = bookTop(book);
    expect(bestBid?.toString()).toBe("0.5");
    expect(bestAsk?.toString()).toBe("0.55");
  });

  it("returns undefined for an empty side, not an invented value", () => {
    const book: OrderBook = { bids: [], asks: [{ price: "0.6", size: "1" }] };
    const { bestBid, bestAsk } = bookTop(book);
    expect(bestBid).toBeUndefined();
    expect(bestAsk?.toString()).toBe("0.6");
  });

  it("returns undefined for a fully empty book", () => {
    const { bestBid, bestAsk } = bookTop({ bids: [], asks: [] });
    expect(bestBid).toBeUndefined();
    expect(bestAsk).toBeUndefined();
  });
});

describe("computeSpread", () => {
  it("computes decimal-exact midpoint, spread, and spread_bps", () => {
    const result = computeSpread(new Decimal("0.40"), new Decimal("0.42"));
    expect(result.midpoint.toString()).toBe("0.41");
    expect(result.spread.toString()).toBe("0.02");
    expect(result.spreadBps.toString()).toBe("200");
  });

  it("spread is never negative for a valid (bid <= ask) book", () => {
    const result = computeSpread(new Decimal("0.3"), new Decimal("0.3"));
    expect(result.spread.gte(0)).toBe(true);
  });

  it("never uses floating point subtraction (0.1 + 0.2 style drift)", () => {
    const result = computeSpread(new Decimal("0.1"), new Decimal("0.3"));
    expect(result.spread.toString()).toBe("0.2");
  });
});
