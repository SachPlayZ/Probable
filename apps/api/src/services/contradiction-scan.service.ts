import { appError, type ContradictionCandidate, type ContradictionsResponseData } from "@probable/schemas";
import { ClobClient, GammaClient, type GammaEvent, type GammaMarket } from "@probable/polymarket";
import { multiOutcomeSumCheck, findNearDuplicates, selectPrice, type CandidateMarket } from "@probable/domain";

export interface ContradictionScanParams {
  eventSlug: string;
  scanModes: Array<"multi_outcome_sum" | "logical_implication" | "near_duplicate">;
  minimumEdgePp: number;
}

interface PricedMarket {
  market: GammaMarket;
  price: string | undefined;
  spread: string | undefined;
}

function yesOutcomeIndex(market: GammaMarket): number {
  const idx = market.outcomes.findIndex((o) => o.toLowerCase() === "yes");
  return idx >= 0 ? idx : 0;
}

async function priceMarket(market: GammaMarket, clob: ClobClient): Promise<PricedMarket> {
  const idx = yesOutcomeIndex(market);
  const tokenId = market.clobTokenIds?.[idx];
  const gammaPrice = market.outcomePrices?.[idx];

  let book: { bids: { price: string; size: string }[]; asks: { price: string; size: string }[] } | undefined;
  if (market.enableOrderBook && tokenId) {
    try {
      const raw = await clob.getBook(tokenId);
      book = { bids: raw.bids, asks: raw.asks };
    } catch {
      book = undefined;
    }
  }

  const selection = selectPrice({ book, gammaOutcomePrice: gammaPrice });
  if (!selection.ok) return { market, price: undefined, spread: undefined };
  return { market, price: selection.price, spread: selection.spread };
}

export async function buildContradictionScan(
  params: ContradictionScanParams,
  gamma: GammaClient,
  clob: ClobClient,
): Promise<ContradictionsResponseData> {
  const event: GammaEvent | undefined = await gamma.getEventBySlug(params.eventSlug);
  if (!event) {
    throw appError("MARKET_NOT_FOUND", `No event found for event_slug "${params.eventSlug}".`);
  }

  const warnings: string[] = [];
  const candidates: ContradictionCandidate[] = [];
  const scanModesRun = params.scanModes.filter((m) => m !== "logical_implication");
  if (params.scanModes.includes("logical_implication")) {
    warnings.push(
      "logical_implication scanning is not yet implemented (requires an LLM relation classifier); no candidates were produced for it.",
    );
  }

  if (event.markets.length < 2) {
    warnings.push("This event does not have enough sibling markets to scan for contradictions.");
    return {
      event_slug: event.slug,
      event_title: event.title,
      scan_modes_run: scanModesRun,
      candidates,
      warnings,
    };
  }

  const priced = await Promise.all(event.markets.map((m) => priceMarket(m, clob)));
  const withPrice = priced.filter((p): p is PricedMarket & { price: string } => p.price !== undefined);

  if (withPrice.length < event.markets.length) {
    warnings.push(
      `${event.markets.length - withPrice.length} sibling market(s) had no defensible price and were excluded from scanning.`,
    );
  }

  if (params.scanModes.includes("multi_outcome_sum")) {
    const negRiskGroup = withPrice.filter((p) => p.market.negRisk === true);
    if (negRiskGroup.length >= 2) {
      const midpoints = negRiskGroup.map((p) => p.price);
      const spreads = negRiskGroup.map((p) => p.spread ?? "0");
      const result = multiOutcomeSumCheck(midpoints, spreads);
      if (result.flagged) {
        candidates.push({
          type: "multi_outcome_sum",
          market_ids: negRiskGroup.map((p) => p.market.id),
          questions: negRiskGroup.map((p) => p.market.question),
          probabilities_percent: negRiskGroup.map((p) => (Number(p.price) * 100).toString()),
          discrepancy_pp: (Number(result.rawExcess) * 100).toString(),
          relationship: "mutually_exclusive_exhaustive_outcome_set",
          why_may_fail:
            "The set may not actually be mutually exclusive and exhaustive, or the excess may reflect real spread, fees, or timing differences rather than a pricing discrepancy.",
          buffer_pp: (Number(result.buffer) * 100).toString(),
          confidence: "high",
          manual_checks_required: [
            "Confirm every outcome in the group is mutually exclusive and the set is collectively exhaustive.",
            "Confirm all quoted prices were captured at the same moment.",
          ],
        });
      }
    } else if (withPrice.some((p) => p.market.negRisk === true)) {
      warnings.push("Fewer than two priced markets in this event's negRisk group; multi_outcome_sum was skipped.");
    }
  }

  if (params.scanModes.includes("near_duplicate")) {
    const candidateMarkets: CandidateMarket[] = withPrice.map((p) => ({
      marketId: p.market.id,
      question: p.market.question,
      endDate: p.market.endDate,
      midpoint: p.price,
    }));
    const pairs = findNearDuplicates(candidateMarkets, params.minimumEdgePp.toString());
    for (const pair of pairs) {
      const marketA = withPrice.find((p) => p.market.id === pair.marketAId)!;
      const marketB = withPrice.find((p) => p.market.id === pair.marketBId)!;
      candidates.push({
        type: "near_duplicate",
        market_ids: [pair.marketAId, pair.marketBId],
        questions: [marketA.market.question, marketB.market.question],
        probabilities_percent: [
          (Number(marketA.price) * 100).toString(),
          (Number(marketB.price) * 100).toString(),
        ],
        discrepancy_pp: pair.discrepancyPp,
        relationship: "candidate_near_duplicate_claim",
        why_may_fail:
          "Questions may differ in resolution source, exact thresholds, or definitions despite similar wording — this is a lexical-similarity match, not a verified semantic equivalence.",
        buffer_pp: params.minimumEdgePp.toString(),
        confidence: "medium",
        manual_checks_required: [
          "Confirm both markets share the same resolution source and threshold.",
          "Confirm the outcome definitions are identical, not just similarly worded.",
        ],
      });
    }
  }

  return {
    event_slug: event.slug,
    event_title: event.title,
    scan_modes_run: scanModesRun,
    candidates,
    warnings,
  };
}
