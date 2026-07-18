import { z } from "zod";

export const searchRequestSchema = z
  .object({
    // Optional: OKX's A2MCP free-endpoint self-check does a bare `POST` with no
    // body and requires HTTP 200 back (never a validation error) — see search.service.ts.
    query: z.string().max(500).default(""),
    limit: z.number().int().positive().max(5).default(5),
    active_only: z.boolean().default(true),
  })
  .strict();

export type SearchRequest = z.infer<typeof searchRequestSchema>;

export const searchMatchSchema = z.object({
  market_id: z.string(),
  event_slug: z.string().optional(),
  market_slug: z.string().optional(),
  question: z.string(),
  match_score: z.number().min(0).max(100),
  status: z.enum(["active", "closed", "resolved", "unknown"]),
  enable_order_book: z.boolean(),
  source_url: z.string().optional(),
  why_matched: z.string(),
  confidence: z.enum(["match", "possible_match"]),
});

export type SearchMatch = z.infer<typeof searchMatchSchema>;

export const searchResponseDataSchema = z.object({
  query: z.string(),
  matches: z.array(searchMatchSchema),
});

export type SearchResponseData = z.infer<typeof searchResponseDataSchema>;
