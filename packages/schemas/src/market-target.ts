import { z } from "zod";
import { appError } from "./errors.js";

/** Wire shape: client sends at most one identifier. snake_case per public API convention. */
export const marketTargetInputSchema = z
  .object({
    query: z.string().min(1).max(500).optional(),
    url: z.string().url().max(2048).optional(),
    event_slug: z.string().min(1).max(200).optional(),
    market_slug: z.string().min(1).max(200).optional(),
    market_id: z.string().min(1).max(200).optional(),
    condition_id: z.string().min(1).max(200).optional(),
  })
  .strict();

export type MarketTargetInput = z.infer<typeof marketTargetInputSchema>;

/** Internal discriminated union — exactly one variant, per PLAN.md §10.1. */
export type MarketTarget =
  | { type: "query"; query: string }
  | { type: "url"; url: string }
  | { type: "eventSlug"; eventSlug: string }
  | { type: "marketSlug"; marketSlug: string }
  | { type: "marketId"; marketId: string }
  | { type: "conditionId"; conditionId: string };

const FIELD_MAP: Array<{ key: keyof MarketTargetInput; type: MarketTarget["type"] }> = [
  { key: "query", type: "query" },
  { key: "url", type: "url" },
  { key: "event_slug", type: "eventSlug" },
  { key: "market_slug", type: "marketSlug" },
  { key: "market_id", type: "marketId" },
  { key: "condition_id", type: "conditionId" },
];

/**
 * Multiple identifiers supplied → reject with INVALID_TARGET rather than guessing
 * which one wins (AGENTS.md §9 / PLAN.md §10.1).
 */
export function toMarketTarget(input: MarketTargetInput): MarketTarget {
  const present = FIELD_MAP.filter(({ key }) => input[key] !== undefined);

  if (present.length === 0) {
    throw appError("INVALID_TARGET", "No market target identifier was provided.");
  }
  if (present.length > 1) {
    throw appError(
      "INVALID_TARGET",
      "Multiple market target identifiers were provided; supply exactly one.",
      { fields: present.map((p) => p.key) },
    );
  }

  const { key, type } = present[0]!;
  const value = input[key]!;

  switch (type) {
    case "query":
      return { type: "query", query: value };
    case "url":
      return { type: "url", url: value };
    case "eventSlug":
      return { type: "eventSlug", eventSlug: value };
    case "marketSlug":
      return { type: "marketSlug", marketSlug: value };
    case "marketId":
      return { type: "marketId", marketId: value };
    case "conditionId":
      return { type: "conditionId", conditionId: value };
  }
}
