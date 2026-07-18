import { appError, type SearchMatch, type SearchResponseData } from "@probable/schemas";
import type { GammaClient } from "@probable/polymarket";
import { isAmbiguous, MATCH_THRESHOLD, rankMarkets, type RankedMarket } from "./search-ranking.js";

export interface SearchParams {
  query: string;
  limit: number;
  activeOnly: boolean;
}

function toSearchMatch(ranked: RankedMarket): SearchMatch {
  const { market } = ranked;
  const eventSlug = market.events?.[0]?.slug;
  return {
    market_id: market.id,
    event_slug: eventSlug,
    market_slug: market.slug,
    question: market.question,
    match_score: ranked.score,
    status: market.active && !market.closed ? "active" : market.closed ? "closed" : "unknown",
    enable_order_book: market.enableOrderBook ?? false,
    source_url: market.slug ? `https://polymarket.com/market/${market.slug}` : undefined,
    why_matched: ranked.whyMatched,
    confidence: ranked.score >= MATCH_THRESHOLD ? "match" : "possible_match",
  };
}

export async function searchMarkets(
  params: SearchParams,
  gamma: GammaClient,
): Promise<SearchResponseData> {
  if (!params.query.trim()) {
    return { query: params.query, matches: [] };
  }

  const raw = await gamma.publicSearch(params.query, params.limit);
  let markets = raw.events.flatMap((event) => event.markets ?? []);

  if (params.activeOnly) {
    markets = markets.filter((m) => m.active && !m.closed);
  }

  const ranked = rankMarkets(params.query, markets);

  if (ranked.length === 0) {
    throw appError("MARKET_NOT_FOUND", "No sufficiently relevant active market was found.");
  }

  if (isAmbiguous(ranked)) {
    throw appError(
      "AMBIGUOUS_MARKET",
      "Top candidates are too close in relevance to select automatically.",
      { candidates: ranked.slice(0, params.limit).map(toSearchMatch) },
    );
  }

  return {
    query: params.query,
    matches: ranked.slice(0, params.limit).map(toSearchMatch),
  };
}
