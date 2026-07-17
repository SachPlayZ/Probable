import { appError } from "@probable/schemas";
import { fetchJson, UpstreamHttpError } from "./http.js";
import {
  holdersResponseSchema,
  openInterestSchema,
  tradesResponseSchema,
  type HoldersResponse,
  type OpenInterestResponse,
  type TradesResponse,
} from "./schemas/data.schema.js";

export interface DataClientOptions {
  baseUrl: string;
  timeoutMs?: number | undefined;
  signal?: AbortSignal | undefined;
}

function mapUpstreamError(err: unknown, context: string): never {
  if (err instanceof UpstreamHttpError) {
    switch (err.kind) {
      case "timeout":
        throw appError("UPSTREAM_TIMEOUT", `Data API timeout: ${context}`);
      case "rate_limited":
        throw appError("UPSTREAM_RATE_LIMITED", `Data API rate limited: ${context}`);
      case "invalid_schema":
        throw appError("UPSTREAM_SCHEMA_CHANGED", `Data API schema changed: ${context}`, undefined, err);
      case "not_found":
        throw appError("MARKET_NOT_FOUND", `Data API resource not found: ${context}`);
      default:
        throw appError("UPSTREAM_UNAVAILABLE", `Data API unavailable: ${context}`, undefined, err);
    }
  }
  throw appError("UPSTREAM_UNAVAILABLE", `Data API request failed: ${context}`, undefined, err);
}

export class DataClient {
  constructor(private readonly options: DataClientOptions) {}

  /** `conditionId` — the Data API's `market` query param expects the condition ID, not a token/asset ID. */
  async getOpenInterest(conditionId: string): Promise<OpenInterestResponse> {
    const url = new URL("/oi", this.options.baseUrl);
    url.searchParams.set("market", conditionId);
    try {
      return await fetchJson(url.toString(), {
        schema: openInterestSchema,
        timeoutMs: this.options.timeoutMs,
        signal: this.options.signal,
      });
    } catch (err) {
      mapUpstreamError(err, `getOpenInterest(${conditionId})`);
    }
  }

  async getHolders(conditionId: string, limit = 10): Promise<HoldersResponse> {
    const url = new URL("/holders", this.options.baseUrl);
    url.searchParams.set("market", conditionId);
    url.searchParams.set("limit", String(limit));
    try {
      return await fetchJson(url.toString(), {
        schema: holdersResponseSchema,
        timeoutMs: this.options.timeoutMs,
        signal: this.options.signal,
      });
    } catch (err) {
      mapUpstreamError(err, `getHolders(${conditionId})`);
    }
  }

  async getTrades(conditionId: string, limit = 100): Promise<TradesResponse> {
    const url = new URL("/trades", this.options.baseUrl);
    url.searchParams.set("market", conditionId);
    url.searchParams.set("limit", String(limit));
    try {
      return await fetchJson(url.toString(), {
        schema: tradesResponseSchema,
        timeoutMs: this.options.timeoutMs,
        signal: this.options.signal,
      });
    } catch (err) {
      mapUpstreamError(err, `getTrades(${conditionId})`);
    }
  }
}
