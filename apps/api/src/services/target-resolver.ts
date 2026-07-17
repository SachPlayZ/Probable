import { appError, normalizedMarketSchema, type MarketTarget, type NormalizedMarket } from "@probable/schemas";
import { GammaClient, normalizeGammaMarket, type GammaMarket } from "@probable/polymarket";
import { isAmbiguous, rankMarkets } from "./search-ranking.js";
import { parsePolymarketUrl } from "./url-parser.js";

function toNormalized(market: GammaMarket): NormalizedMarket {
  return normalizedMarketSchema.parse(normalizeGammaMarket(market));
}

async function resolveViaQuery(query: string, gamma: GammaClient): Promise<NormalizedMarket> {
  const raw = await gamma.publicSearch(query, 5);
  const markets = raw.events.flatMap((e) => e.markets ?? []);
  const ranked = rankMarkets(query, markets);

  if (ranked.length === 0) {
    throw appError("MARKET_NOT_FOUND", "No sufficiently relevant active market was found for this query.");
  }
  if (isAmbiguous(ranked)) {
    throw appError("AMBIGUOUS_MARKET", "Top candidates are too close in relevance to select automatically.", {
      candidates: ranked.slice(0, 5).map((r) => ({ market_id: r.market.id, question: r.market.question, score: r.score })),
    });
  }

  const [best] = ranked;
  return toNormalized(best!.market);
}

async function resolveViaEventSlug(eventSlug: string, gamma: GammaClient): Promise<NormalizedMarket> {
  const event = await gamma.getEventBySlug(eventSlug);
  if (!event || event.markets.length === 0) {
    throw appError("MARKET_NOT_FOUND", `No market found for event slug "${eventSlug}".`);
  }
  if (event.markets.length > 1) {
    throw appError(
      "AMBIGUOUS_MARKET",
      "This event has multiple markets; specify market_slug or market_id.",
      { candidates: event.markets.map((m) => ({ market_id: m.id, market_slug: m.slug, question: m.question })) },
    );
  }
  return toNormalized(event.markets[0]!);
}

/**
 * Resolution order per PLAN.md §13: explicit ID > URL slug > explicit slug > query search.
 * Never silently chooses when ambiguous — returns AMBIGUOUS_MARKET / MARKET_NOT_FOUND instead.
 */
export async function resolveMarketTarget(target: MarketTarget, gamma: GammaClient): Promise<NormalizedMarket> {
  switch (target.type) {
    case "marketId": {
      const market = await gamma.getMarketById(target.marketId);
      if (!market) throw appError("MARKET_NOT_FOUND", `No market found for market_id "${target.marketId}".`);
      return toNormalized(market);
    }
    case "marketSlug": {
      const market = await gamma.getMarketBySlug(target.marketSlug);
      if (!market) throw appError("MARKET_NOT_FOUND", `No market found for market_slug "${target.marketSlug}".`);
      return toNormalized(market);
    }
    case "conditionId": {
      const market = await gamma.getMarketByConditionId(target.conditionId);
      if (!market) {
        throw appError("MARKET_NOT_FOUND", `No market found for condition_id "${target.conditionId}".`);
      }
      return toNormalized(market);
    }
    case "eventSlug":
      return resolveViaEventSlug(target.eventSlug, gamma);
    case "url": {
      const parsed = parsePolymarketUrl(target.url);
      return parsed.kind === "event" ? resolveViaEventSlug(parsed.slug, gamma) : resolveMarketTarget(
        { type: "marketSlug", marketSlug: parsed.slug },
        gamma,
      );
    }
    case "query":
      return resolveViaQuery(target.query, gamma);
  }
}
