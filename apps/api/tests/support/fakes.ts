import { GammaClient, ClobClient, type GammaMarket, type GammaEvent, type GammaPublicSearchResponse, type ClobBook, type ClobPriceHistory } from "@probable/polymarket";

export function makeMarket(overrides: Partial<GammaMarket> = {}): GammaMarket {
  return {
    id: "mkt-1",
    question: "Will the Fed cut rates before October?",
    conditionId: "0xcondition1",
    slug: "fed-cut-rates-before-october",
    resolutionSource: "https://federalreserve.gov",
    endDate: "2026-10-01T00:00:00Z",
    description: "Resolves YES if the Fed cuts rates before October 1, 2026.",
    outcomes: ["Yes", "No"],
    outcomePrices: ["0.62", "0.38"],
    clobTokenIds: ["token-yes-1", "token-no-1"],
    active: true,
    closed: false,
    enableOrderBook: true,
    updatedAt: new Date().toISOString(),
    events: [{ id: "evt-1", slug: "fed-decision-2026", title: "Fed decision 2026" }],
    liquidityNum: 10000,
    ...overrides,
  };
}

export class FakeGammaClient extends GammaClient {
  publicSearchImpl: (query: string) => Promise<GammaPublicSearchResponse> = async () => ({
    events: [{ id: "evt-1", slug: "fed-decision-2026", title: "Fed decision 2026", markets: [makeMarket()] }],
  });
  marketsBySlug: Record<string, GammaMarket | undefined> = {};
  marketsById: Record<string, GammaMarket | undefined> = {};
  eventsBySlug: Record<string, GammaEvent | undefined> = {};

  constructor() {
    super({ baseUrl: "http://fake-gamma.invalid" });
  }

  override async publicSearch(query: string): Promise<GammaPublicSearchResponse> {
    return this.publicSearchImpl(query);
  }

  override async getMarketBySlug(slug: string): Promise<GammaMarket | undefined> {
    return this.marketsBySlug[slug];
  }

  override async getMarketById(id: string): Promise<GammaMarket | undefined> {
    return this.marketsById[id];
  }

  override async getMarketByConditionId(): Promise<GammaMarket | undefined> {
    return undefined;
  }

  override async getEventBySlug(slug: string): Promise<GammaEvent | undefined> {
    return this.eventsBySlug[slug];
  }
}

export class FakeClobClient extends ClobClient {
  bookCallCount = 0;
  bookImpl: (tokenId: string) => Promise<ClobBook> = async (tokenId) => ({
    market: "0xcondition1",
    asset_id: tokenId,
    bids: [{ price: "0.6", size: "100" }],
    asks: [{ price: "0.64", size: "100" }],
  });
  historyImpl: () => Promise<ClobPriceHistory> = async () => ({ history: [] });

  constructor() {
    super({ baseUrl: "http://fake-clob.invalid" });
  }

  override async getBook(tokenId: string): Promise<ClobBook> {
    this.bookCallCount += 1;
    return this.bookImpl(tokenId);
  }

  override async getMidpoint(): Promise<string | undefined> {
    return "0.62";
  }

  override async getPricesHistory(): Promise<ClobPriceHistory> {
    return this.historyImpl();
  }
}
