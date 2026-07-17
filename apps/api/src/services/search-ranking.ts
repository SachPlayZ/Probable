import { computeMatchScore, recencyScoreFromUpdatedAt, tokenOverlapScore } from "@probable/domain";
import type { GammaMarket } from "@probable/polymarket";

export const MATCH_THRESHOLD = 60;
export const AMBIGUITY_GAP = 5;

export interface RankedMarket {
  market: GammaMarket;
  score: number;
  whyMatched: string;
}

export function rankMarkets(query: string, markets: GammaMarket[], now = Date.now()): RankedMarket[] {
  const seen = new Set<string>();
  const ranked: RankedMarket[] = [];

  for (const market of markets) {
    if (seen.has(market.id)) continue;
    seen.add(market.id);

    const overlap = tokenOverlapScore(query, market.question);
    const score = computeMatchScore({
      semanticSimilarity: overlap,
      titleTokenOverlap: overlap,
      activeStatus: market.active && !market.closed,
      orderbookEnabled: market.enableOrderBook ?? false,
      recencyScore: recencyScoreFromUpdatedAt(market.updatedAt, now),
      liquidityPresent: (market.liquidityNum ?? 0) > 0,
    });

    ranked.push({
      market,
      score,
      whyMatched:
        overlap > 0
          ? `Shares key terms with your query (lexical overlap ${overlap}/100).`
          : "Matched via Polymarket search relevance; low direct term overlap with your query.",
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

/** Materially different = different market, not just a score-gap artifact. */
export function isAmbiguous(ranked: RankedMarket[]): boolean {
  if (ranked.length < 2) return false;
  const [top, second] = ranked;
  if (!top || !second) return false;
  const gap = top.score - second.score;
  return gap <= AMBIGUITY_GAP && top.market.id !== second.market.id;
}
