import { Decimal } from "decimal.js";
import { tokenOverlapScore } from "../search/token-overlap.js";

export interface CandidateMarket {
  marketId: string;
  question: string;
  endDate: string | undefined;
  midpoint: string;
}

export interface NearDuplicatePair {
  marketAId: string;
  marketBId: string;
  similarityScore: number;
  discrepancyPp: string;
  sameDeadline: boolean;
}

/** Lexical similarity floor for two questions to count as the "same real-world claim" — methodology v1. */
const SIMILARITY_THRESHOLD = 85;

/**
 * PLAN.md §12.5 mode C. Deterministic lexical-similarity proxy for now — an LLM-based
 * semantic near-duplicate classifier is a later enhancement (same scoped-simplification
 * pattern as Search's match_score; see tasks/decisions.md).
 *
 * Only compares markets with an identical stated deadline — different deadlines mean
 * the claims aren't actually the same bet, so they're never compared (AGENTS.md §13:
 * "never compare markets without aligning deadlines and definitions").
 */
export function findNearDuplicates(markets: CandidateMarket[], minimumEdgePp: string): NearDuplicatePair[] {
  const pairs: NearDuplicatePair[] = [];
  const minEdge = new Decimal(minimumEdgePp);

  for (let i = 0; i < markets.length; i++) {
    for (let j = i + 1; j < markets.length; j++) {
      const a = markets[i]!;
      const b = markets[j]!;
      if (a.marketId === b.marketId) continue;

      const sameDeadline = a.endDate !== undefined && a.endDate === b.endDate;
      if (!sameDeadline) continue;

      const similarity = tokenOverlapScore(a.question, b.question);
      if (similarity < SIMILARITY_THRESHOLD) continue;

      const discrepancyPp = new Decimal(a.midpoint).minus(b.midpoint).abs().times(100);
      if (discrepancyPp.lte(minEdge)) continue;

      pairs.push({
        marketAId: a.marketId,
        marketBId: b.marketId,
        similarityScore: similarity,
        discrepancyPp: discrepancyPp.toString(),
        sameDeadline,
      });
    }
  }

  return pairs;
}
