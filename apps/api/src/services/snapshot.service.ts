import { appError, type NormalizedMarket, type SnapshotResponseData } from "@probable/schemas";
import { ClobClient } from "@probable/polymarket";
import { changePp, selectPrice, toPercent, type OrderBook } from "@probable/domain";
import type { ClobPriceHistory } from "@probable/polymarket";

const WINDOW_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

function nearestPointBefore(history: ClobPriceHistory, cutoffMs: number): number | undefined {
  let best: { t: number; p: number } | undefined;
  for (const point of history.history) {
    const pointMs = point.t * 1000;
    if (pointMs <= cutoffMs && (!best || pointMs > best.t * 1000)) {
      best = point;
    }
  }
  return best?.p;
}

export interface SnapshotParams {
  market: NormalizedMarket;
  outcome: string;
  comparisonWindows: string[];
}

export async function buildSnapshot(params: SnapshotParams, clob: ClobClient): Promise<SnapshotResponseData> {
  const { market, outcome, comparisonWindows } = params;

  const matchedOutcome = market.outcomes.find((o) => o.name.toLowerCase() === outcome.toLowerCase());
  if (!matchedOutcome) {
    throw appError("INVALID_REQUEST", `Outcome "${outcome}" is not defined on this market.`, {
      available_outcomes: market.outcomes.map((o) => o.name),
    });
  }

  const warnings: string[] = [];
  let book: OrderBook | undefined;

  if (market.enableOrderBook && matchedOutcome.tokenId) {
    try {
      const raw = await clob.getBook(matchedOutcome.tokenId);
      book = { bids: raw.bids, asks: raw.asks };
    } catch {
      warnings.push("Live order book was unavailable; falling back to the Gamma outcome price.");
    }
  } else {
    warnings.push("This market does not have order book trading enabled.");
  }

  const selection = selectPrice({
    book,
    gammaOutcomePrice: matchedOutcome.gammaPrice,
  });

  if (!selection.ok) {
    throw appError("INSUFFICIENT_MARKET_DATA", "No defensible price is available for this market and outcome.");
  }

  const changesPp: Record<string, string | undefined> = {};
  if (matchedOutcome.tokenId) {
    try {
      const history = await clob.getPricesHistory(matchedOutcome.tokenId, "1w", 60);
      const now = Date.now();
      for (const window of comparisonWindows) {
        const ms = WINDOW_MS[window];
        if (!ms) continue;
        const historicalPrice = nearestPointBefore(history, now - ms);
        changesPp[window] = historicalPrice === undefined ? undefined : changePp(selection.price, String(historicalPrice));
      }
    } catch {
      warnings.push("Historical comparison is temporarily unavailable.");
      for (const window of comparisonWindows) changesPp[window] = undefined;
    }
  } else {
    for (const window of comparisonWindows) changesPp[window] = undefined;
  }

  return {
    market_id: market.marketId,
    market_slug: market.marketSlug,
    event_slug: market.eventSlug,
    question: market.question,
    outcome: matchedOutcome.name,
    implied_probability_percent: toPercent(selection.price),
    pricing_method: selection.method,
    best_bid: selection.bestBid,
    best_ask: selection.bestAsk,
    spread: selection.spread,
    spread_bps: selection.spreadBps,
    changes_pp: changesPp,
    warnings: [...warnings, ...selection.warnings],
  };
}
