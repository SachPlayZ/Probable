import { z } from "zod";

export const openInterestSchema = z.array(
  z.object({
    market: z.string(),
    value: z.number(),
  }),
);
export type OpenInterestResponse = z.infer<typeof openInterestSchema>;

export const holderSchema = z.object({
  proxyWallet: z.string(),
  amount: z.number(),
  outcomeIndex: z.number(),
});

export const holdersResponseSchema = z.array(
  z.object({
    token: z.string(),
    holders: z.array(holderSchema),
  }),
);
export type HoldersResponse = z.infer<typeof holdersResponseSchema>;

export const tradeSchema = z.object({
  proxyWallet: z.string(),
  side: z.enum(["BUY", "SELL"]),
  asset: z.string(),
  conditionId: z.string(),
  size: z.number(),
  price: z.number(),
  timestamp: z.number(),
  outcome: z.string().optional(),
});

export const tradesResponseSchema = z.array(tradeSchema);
export type TradesResponse = z.infer<typeof tradesResponseSchema>;
