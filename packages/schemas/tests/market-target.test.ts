import { describe, expect, it } from "vitest";
import { marketTargetInputSchema, toMarketTarget } from "../src/market-target.js";
import { AppError } from "../src/errors.js";

describe("toMarketTarget", () => {
  it("accepts exactly one identifier", () => {
    const input = marketTargetInputSchema.parse({ event_slug: "fed-decision" });
    expect(toMarketTarget(input)).toEqual({ type: "eventSlug", eventSlug: "fed-decision" });
  });

  it("rejects zero identifiers", () => {
    const input = marketTargetInputSchema.parse({});
    expect(() => toMarketTarget(input)).toThrow(AppError);
  });

  it("rejects multiple identifiers rather than guessing", () => {
    const input = marketTargetInputSchema.parse({
      event_slug: "fed-decision",
      market_slug: "fed-decision-yes",
    });
    try {
      toMarketTarget(input);
      throw new Error("expected toMarketTarget to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("INVALID_TARGET");
    }
  });

  it("rejects unknown fields at the schema layer", () => {
    expect(() => marketTargetInputSchema.parse({ event_slug: "x", bogus: "y" })).toThrow();
  });
});
