import { z } from "zod";
import { marketTargetInputSchema } from "./market-target.js";

export const snapshotRequestSchema = z
  .object({
    target: marketTargetInputSchema,
    outcome: z.string().min(1).max(100).default("Yes"),
    comparison_windows: z.array(z.enum(["1h", "24h", "7d"])).default(["1h", "24h", "7d"]),
  })
  .strict();

export type SnapshotRequest = z.infer<typeof snapshotRequestSchema>;

export const pricingMethodSchema = z.enum(["orderbook_midpoint", "last_trade", "gamma_outcome_price"]);

export const snapshotResponseDataSchema = z.object({
  market_id: z.string(),
  market_slug: z.string().optional(),
  event_slug: z.string().optional(),
  question: z.string(),
  outcome: z.string(),
  implied_probability_percent: z.string(),
  pricing_method: pricingMethodSchema,
  best_bid: z.string().optional(),
  best_ask: z.string().optional(),
  spread: z.string().optional(),
  spread_bps: z.string().optional(),
  last_trade_price: z.string().optional(),
  changes_pp: z.record(z.string(), z.string().optional()),
  warnings: z.array(z.string()),
});

export type SnapshotResponseData = z.infer<typeof snapshotResponseDataSchema>;
