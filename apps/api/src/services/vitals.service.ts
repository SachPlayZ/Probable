import { appError, type NormalizedMarket, type VitalsResponseData } from "@probable/schemas";
import { ClobClient, DataClient } from "@probable/polymarket";
import {
  bookTop,
  computeSpread,
  computeQualityScore,
  depthWithinBand,
  exitDifficulty,
  simulateMarketOrder,
  type OrderBook,
} from "@probable/domain";
import { Decimal } from "decimal.js";

export interface VitalsParams {
  market: NormalizedMarket;
  outcome: string;
  tradeSizesUsd: number[];
  depthBands: number[];
}

const RECENT_ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function buildVitals(
  params: VitalsParams,
  clob: ClobClient,
  data: DataClient,
): Promise<VitalsResponseData> {
  const { market, outcome, tradeSizesUsd, depthBands } = params;

  const matchedOutcome = market.outcomes.find((o) => o.name.toLowerCase() === outcome.toLowerCase());
  if (!matchedOutcome) {
    throw appError("INVALID_REQUEST", `Outcome "${outcome}" is not defined on this market.`, {
      available_outcomes: market.outcomes.map((o) => o.name),
    });
  }

  const warnings: string[] = [];

  if (!market.enableOrderBook || !matchedOutcome.tokenId) {
    throw appError(
      "MARKET_NOT_ORDERBOOK_ENABLED",
      "Market Vitals requires live order-book depth; this market does not have order-book trading enabled.",
    );
  }

  const tokenId = matchedOutcome.tokenId;
  const conditionId = market.conditionId;

  let book: OrderBook | undefined;
  try {
    const raw = await clob.getBook(tokenId);
    book = { bids: raw.bids, asks: raw.asks };
  } catch {
    throw appError("INSUFFICIENT_MARKET_DATA", "Live order book is unavailable for this market right now.");
  }

  const { bestBid, bestAsk } = bookTop(book);
  const referencePrice = bestBid && bestAsk ? computeSpread(bestBid, bestAsk).midpoint : (bestBid ?? bestAsk);

  if (!referencePrice) {
    throw appError("INSUFFICIENT_MARKET_DATA", "Order book is empty; no defensible reference price.");
  }

  const spreadInfo = bestBid && bestAsk ? computeSpread(bestBid, bestAsk) : undefined;
  if (!spreadInfo) warnings.push("Order book is one-sided; spread and two-sided depth are unavailable.");

  const depth = depthBands.map((band) => {
    const bandStr = band.toString();
    const { bidDepthUsd, askDepthUsd } = depthWithinBand(book!, referencePrice.toString(), bandStr);
    return { band: bandStr, bid_depth_usd: bidDepthUsd, ask_depth_usd: askDepthUsd };
  });

  const fills = tradeSizesUsd.map((size) => {
    const sizeStr = size.toString();
    const buy = simulateMarketOrder(book!.asks, "buy", sizeStr, referencePrice.toString());
    const sell = simulateMarketOrder(book!.bids, "sell", sizeStr, referencePrice.toString());
    return {
      trade_size_usd: sizeStr,
      buy: {
        vwap: buy.vwap,
        price_impact: buy.priceImpact,
        fill_ratio: buy.fillRatio,
        partial_fill: buy.partialFill,
      },
      sell: {
        vwap: sell.vwap,
        price_impact: sell.priceImpact,
        fill_ratio: sell.fillRatio,
        partial_fill: sell.partialFill,
      },
      // "Exit difficulty" describes closing an existing position — modeled on the sell leg.
      exit_difficulty: exitDifficulty(sell),
    };
  });

  let recentTradeCount = 0;
  let recentVolumeUsd = new Decimal(0);
  let latestTradeAt: string | undefined;
  let latestTradeAgeMs = Number.POSITIVE_INFINITY;

  if (conditionId) {
    try {
      const trades = await data.getTrades(conditionId, 200);
      const now = Date.now();
      let latestTs = 0;
      for (const trade of trades) {
        const tradeMs = trade.timestamp * 1000;
        if (now - tradeMs <= RECENT_ACTIVITY_WINDOW_MS) {
          recentTradeCount += 1;
          recentVolumeUsd = recentVolumeUsd.plus(new Decimal(trade.price).times(trade.size));
        }
        if (tradeMs > latestTs) latestTs = tradeMs;
      }
      if (latestTs > 0) {
        latestTradeAt = new Date(latestTs).toISOString();
        latestTradeAgeMs = now - latestTs;
      }
    } catch {
      warnings.push("Recent trade activity is temporarily unavailable.");
    }
  } else {
    warnings.push("No condition ID available; activity and open-interest data are unavailable.");
  }

  let openInterestUsd: string | undefined;
  if (conditionId) {
    try {
      const oi = await data.getOpenInterest(conditionId);
      openInterestUsd = oi[0]?.value.toString();
    } catch {
      warnings.push("Open interest is temporarily unavailable.");
    }
  }

  let topHolderShare: string | undefined;
  if (conditionId) {
    try {
      const holdersResponse = await data.getHolders(conditionId, 20);
      const holders = holdersResponse.find((h) => h.token === tokenId)?.holders ?? holdersResponse[0]?.holders;
      if (holders && holders.length > 0) {
        const total = holders.reduce((sum, h) => sum + h.amount, 0);
        const top = holders[0]!.amount;
        // Proxy: share of the top holder among visible top holders, not true total supply —
        // Polymarket's public holders endpoint does not expose total outstanding shares.
        topHolderShare = total > 0 ? new Decimal(top).div(total).toString() : undefined;
        warnings.push("Top-holder concentration is approximated from visible top holders, not total supply.");
      }
    } catch {
      warnings.push("Holder concentration is temporarily unavailable.");
    }
  }

  const twoSidedDepthUsd = depth.length > 0
    ? new Decimal(depth[depth.length - 1]!.bid_depth_usd).plus(depth[depth.length - 1]!.ask_depth_usd).toString()
    : "0";

  const quality = computeQualityScore({
    spread: spreadInfo?.spread.toString() ?? "1",
    twoSidedDepthUsd,
    recentVolumeUsd: recentVolumeUsd.toString(),
    openInterestUsd: openInterestUsd ?? "0",
    latestActivityAgeMs: Number.isFinite(latestTradeAgeMs) ? latestTradeAgeMs : 30 * 24 * 60 * 60 * 1000,
    topHolderShare,
  });

  return {
    market_id: market.marketId,
    market_slug: market.marketSlug,
    event_slug: market.eventSlug,
    question: market.question,
    outcome: matchedOutcome.name,
    best_bid: bestBid?.toString(),
    best_ask: bestAsk?.toString(),
    spread: spreadInfo?.spread.toString(),
    spread_bps: spreadInfo?.spreadBps.toString(),
    depth,
    fills,
    activity: {
      recent_trade_count: recentTradeCount,
      recent_volume_usd: recentVolumeUsd.toString(),
      latest_trade_at: latestTradeAt,
    },
    open_interest_usd: openInterestUsd,
    top_holder_share: topHolderShare,
    quality_score: quality.score,
    quality_components: quality.components,
    warnings,
  };
}
