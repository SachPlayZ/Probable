import { appError } from "@probable/schemas";
import { fetchJson, UpstreamHttpError } from "./http.js";
import {
  gammaEventsResponseSchema,
  gammaMarketsResponseSchema,
  gammaPublicSearchResponseSchema,
  type GammaEvent,
  type GammaMarket,
  type GammaPublicSearchResponse,
} from "./schemas/gamma.schema.js";

export interface GammaClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function mapUpstreamError(err: unknown, context: string): never {
  if (err instanceof UpstreamHttpError) {
    switch (err.kind) {
      case "timeout":
        throw appError("UPSTREAM_TIMEOUT", `Gamma timeout: ${context}`);
      case "rate_limited":
        throw appError("UPSTREAM_RATE_LIMITED", `Gamma rate limited: ${context}`);
      case "invalid_schema":
        throw appError("UPSTREAM_SCHEMA_CHANGED", `Gamma schema changed: ${context}`, undefined, err);
      case "not_found":
        throw appError("MARKET_NOT_FOUND", `Gamma resource not found: ${context}`);
      default:
        throw appError("UPSTREAM_UNAVAILABLE", `Gamma unavailable: ${context}`, undefined, err);
    }
  }
  throw appError("UPSTREAM_UNAVAILABLE", `Gamma request failed: ${context}`, undefined, err);
}

export class GammaClient {
  constructor(private readonly options: GammaClientOptions) {}

  async publicSearch(query: string, limitPerType = 5): Promise<GammaPublicSearchResponse> {
    const url = new URL("/public-search", this.options.baseUrl);
    url.searchParams.set("q", query);
    url.searchParams.set("limit_per_type", String(limitPerType));
    try {
      return await fetchJson(url.toString(), {
        schema: gammaPublicSearchResponseSchema,
        timeoutMs: this.options.timeoutMs,
        signal: this.options.signal,
      });
    } catch (err) {
      mapUpstreamError(err, "publicSearch");
    }
  }

  async getMarketBySlug(slug: string): Promise<GammaMarket | undefined> {
    return this.getMarketsBy("slug", slug);
  }

  async getMarketById(id: string): Promise<GammaMarket | undefined> {
    return this.getMarketsBy("id", id);
  }

  async getMarketByConditionId(conditionId: string): Promise<GammaMarket | undefined> {
    return this.getMarketsBy("condition_ids", conditionId);
  }

  async getEventBySlug(slug: string): Promise<GammaEvent | undefined> {
    const url = new URL("/events", this.options.baseUrl);
    url.searchParams.set("slug", slug);
    try {
      const events = await fetchJson(url.toString(), {
        schema: gammaEventsResponseSchema,
        timeoutMs: this.options.timeoutMs,
        signal: this.options.signal,
      });
      return events[0];
    } catch (err) {
      mapUpstreamError(err, `getEventBySlug(${slug})`);
    }
  }

  private async getMarketsBy(param: "slug" | "id" | "condition_ids", value: string): Promise<GammaMarket | undefined> {
    const url = new URL("/markets", this.options.baseUrl);
    url.searchParams.set(param, value);
    try {
      const markets = await fetchJson(url.toString(), {
        schema: gammaMarketsResponseSchema,
        timeoutMs: this.options.timeoutMs,
        signal: this.options.signal,
      });
      return markets[0];
    } catch (err) {
      mapUpstreamError(err, `getMarketsBy(${param}=${value})`);
    }
  }
}
