import { z } from "zod";
import { marketTargetInputSchema } from "./market-target.js";

export const vitalsRequestSchema = z
  .object({
    target: marketTargetInputSchema,
    outcome: z.string().min(1).max(100).default("Yes"),
    trade_sizes_usd: z.array(z.number().positive()).min(1).max(5).default([100, 500, 1000]),
    depth_bands: z.array(z.number().positive().max(1)).min(1).max(5).default([0.01, 0.03, 0.05]),
  })
  .strict();

export type VitalsRequest = z.infer<typeof vitalsRequestSchema>;

const fillSideSchema = z.object({
  vwap: z.string().optional(),
  price_impact: z.string().optional(),
  fill_ratio: z.string(),
  partial_fill: z.boolean(),
});

export const vitalsResponseDataSchema = z.object({
  market_id: z.string(),
  market_slug: z.string().optional(),
  event_slug: z.string().optional(),
  question: z.string(),
  outcome: z.string(),
  best_bid: z.string().optional(),
  best_ask: z.string().optional(),
  spread: z.string().optional(),
  spread_bps: z.string().optional(),
  depth: z.array(
    z.object({
      band: z.string(),
      bid_depth_usd: z.string(),
      ask_depth_usd: z.string(),
    }),
  ),
  fills: z.array(
    z.object({
      trade_size_usd: z.string(),
      buy: fillSideSchema,
      sell: fillSideSchema,
      exit_difficulty: z.enum(["easy", "moderate", "hard", "unknown"]),
    }),
  ),
  activity: z.object({
    recent_trade_count: z.number(),
    recent_volume_usd: z.string(),
    latest_trade_at: z.string().optional(),
  }),
  open_interest_usd: z.string().optional(),
  top_holder_share: z.string().optional(),
  quality_score: z.number(),
  quality_components: z.object({
    spread_score: z.number(),
    depth_score: z.number(),
    activity_score: z.number(),
    open_interest_score: z.number(),
    freshness_score: z.number(),
    concentration_score: z.number(),
  }),
  warnings: z.array(z.string()),
});

export type VitalsResponseData = z.infer<typeof vitalsResponseDataSchema>;
