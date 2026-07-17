import type { NormalizedMarket, MarketOutcome } from "@probable/schemas";
import type { GammaMarket } from "./schemas/gamma.schema.js";

function deriveStatus(market: GammaMarket): NormalizedMarket["status"] {
  if (market.active && !market.closed) return "active";
  if (market.closed) return "closed";
  return "unknown";
}

export function normalizeGammaMarket(market: GammaMarket): NormalizedMarket {
  const outcomes: MarketOutcome[] = market.outcomes.map((name, i) => ({
    name,
    tokenId: market.clobTokenIds?.[i],
    gammaPrice: market.outcomePrices?.[i],
  }));

  const event = market.events?.[0];

  return {
    marketId: market.id,
    eventId: event?.id,
    conditionId: market.conditionId,
    marketSlug: market.slug,
    eventSlug: event?.slug,
    question: market.question,
    description: market.description,
    resolutionSource: market.resolutionSource,
    endDate: market.endDate,
    status: deriveStatus(market),
    outcomes,
    // Missing on some lighter search-result summaries; absence must not be read as
    // "order book enabled" — default to false (the safer, non-tradable assumption).
    enableOrderBook: market.enableOrderBook ?? false,
    tags: [],
    sourceUrl: market.slug ? `https://polymarket.com/market/${market.slug}` : undefined,
    rawUpdatedAt: market.updatedAt,
  };
}
