import { z } from "zod";

/** Gamma encodes these as JSON-stringified arrays inside the JSON response. */
function jsonStringArray(fieldName: string) {
  return z.string().transform((raw, ctx) => {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      return parsed as unknown[];
    } catch {
      ctx.addIssue({ code: "custom", message: `${fieldName} is not a JSON-encoded array` });
      return z.NEVER;
    }
  });
}

export const gammaEventRefSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string().optional(),
  })
  .passthrough();

export const gammaMarketSchema = z
  .object({
    id: z.string(),
    question: z.string(),
    conditionId: z.string().optional(),
    slug: z.string().optional(),
    resolutionSource: z.string().optional(),
    endDate: z.string().optional(),
    description: z.string().optional(),
    outcomes: jsonStringArray("outcomes").pipe(z.array(z.string())),
    // Real /public-search responses sometimes omit outcomePrices/enableOrderBook on
    // lighter market summaries (verified against a live response — see contract test
    // "tolerates a real public-search market missing outcomePrices/enableOrderBook").
    // Absence must read as "unknown", never coerced to a default price or true/false.
    outcomePrices: jsonStringArray("outcomePrices").pipe(z.array(z.string())).optional(),
    clobTokenIds: jsonStringArray("clobTokenIds").pipe(z.array(z.string())).optional(),
    active: z.boolean(),
    closed: z.boolean(),
    archived: z.boolean().optional(),
    enableOrderBook: z.boolean().optional(),
    updatedAt: z.string().optional(),
    events: z.array(gammaEventRefSchema).optional(),
    liquidityNum: z.number().optional(),
    volumeNum: z.number().optional(),
    // Polymarket's own "grouped, mutually-exclusive outcome set" signal (e.g. "who will win X")
    // — used to gate the multi-outcome-sum contradiction check to sets it actually applies to.
    negRisk: z.boolean().optional(),
  })
  .passthrough();

export type GammaMarket = z.infer<typeof gammaMarketSchema>;

export const gammaMarketsResponseSchema = z.array(gammaMarketSchema);

export const gammaEventSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    active: z.boolean().optional(),
    closed: z.boolean().optional(),
    markets: z.array(gammaMarketSchema).default([]),
  })
  .passthrough();

export type GammaEvent = z.infer<typeof gammaEventSchema>;

export const gammaEventsResponseSchema = z.array(gammaEventSchema);

export const gammaSearchEventSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    active: z.boolean().optional(),
    closed: z.boolean().optional(),
    markets: z.array(gammaMarketSchema).optional(),
  })
  .passthrough();

export const gammaPublicSearchResponseSchema = z
  .object({
    events: z.array(gammaSearchEventSchema).default([]),
  })
  .passthrough();

export type GammaPublicSearchResponse = z.infer<typeof gammaPublicSearchResponseSchema>;
