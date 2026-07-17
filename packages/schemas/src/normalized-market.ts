import { z } from "zod";

export const marketOutcomeSchema = z.object({
  name: z.string(),
  tokenId: z.string().optional(),
  gammaPrice: z.string().optional(),
});

export const marketStatusSchema = z.enum(["active", "closed", "resolved", "unknown"]);

export const normalizedMarketSchema = z.object({
  marketId: z.string(),
  eventId: z.string().optional(),
  conditionId: z.string().optional(),
  marketSlug: z.string().optional(),
  eventSlug: z.string().optional(),
  question: z.string(),
  description: z.string().optional(),
  resolutionSource: z.string().optional(),
  endDate: z.string().optional(),
  status: marketStatusSchema,
  outcomes: z.array(marketOutcomeSchema),
  enableOrderBook: z.boolean(),
  tags: z.array(z.string()),
  sourceUrl: z.string().optional(),
  rawUpdatedAt: z.string().optional(),
});

export type NormalizedMarket = z.infer<typeof normalizedMarketSchema>;
export type MarketOutcome = z.infer<typeof marketOutcomeSchema>;
