import { z } from "zod";

export const clobBookLevelSchema = z.object({
  price: z.string(),
  size: z.string(),
});

export const clobBookSchema = z
  .object({
    market: z.string().optional(),
    asset_id: z.string().optional(),
    timestamp: z.string().optional(),
    bids: z.array(clobBookLevelSchema),
    asks: z.array(clobBookLevelSchema),
  })
  .passthrough();

export type ClobBook = z.infer<typeof clobBookSchema>;

export const clobMidpointSchema = z.object({ mid: z.string() });
export const clobPriceSchema = z.object({ price: z.string() });
export const clobSpreadSchema = z.object({ spread: z.string() });

export const clobPriceHistoryPointSchema = z.object({
  t: z.number(),
  p: z.number(),
});

export const clobPriceHistorySchema = z.object({
  history: z.array(clobPriceHistoryPointSchema),
});

export type ClobPriceHistory = z.infer<typeof clobPriceHistorySchema>;
