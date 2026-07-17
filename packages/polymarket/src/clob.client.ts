import { appError } from "@probable/schemas";
import { fetchJson, UpstreamHttpError } from "./http.js";
import {
  clobBookSchema,
  clobMidpointSchema,
  clobPriceHistorySchema,
  type ClobBook,
  type ClobPriceHistory,
} from "./schemas/clob.schema.js";

export interface ClobClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function mapUpstreamError(err: unknown, context: string): never {
  if (err instanceof UpstreamHttpError) {
    switch (err.kind) {
      case "timeout":
        throw appError("UPSTREAM_TIMEOUT", `CLOB timeout: ${context}`);
      case "rate_limited":
        throw appError("UPSTREAM_RATE_LIMITED", `CLOB rate limited: ${context}`);
      case "invalid_schema":
        throw appError("UPSTREAM_SCHEMA_CHANGED", `CLOB schema changed: ${context}`, undefined, err);
      case "not_found":
        throw appError("MARKET_NOT_FOUND", `CLOB resource not found: ${context}`);
      default:
        throw appError("UPSTREAM_UNAVAILABLE", `CLOB unavailable: ${context}`, undefined, err);
    }
  }
  throw appError("UPSTREAM_UNAVAILABLE", `CLOB request failed: ${context}`, undefined, err);
}

export class ClobClient {
  constructor(private readonly options: ClobClientOptions) {}

  async getBook(tokenId: string): Promise<ClobBook> {
    const url = new URL("/book", this.options.baseUrl);
    url.searchParams.set("token_id", tokenId);
    try {
      return await fetchJson(url.toString(), {
        schema: clobBookSchema,
        timeoutMs: this.options.timeoutMs,
        signal: this.options.signal,
      });
    } catch (err) {
      mapUpstreamError(err, `getBook(${tokenId})`);
    }
  }

  async getMidpoint(tokenId: string): Promise<string | undefined> {
    const url = new URL("/midpoint", this.options.baseUrl);
    url.searchParams.set("token_id", tokenId);
    try {
      const result = await fetchJson(url.toString(), {
        schema: clobMidpointSchema,
        timeoutMs: this.options.timeoutMs,
        signal: this.options.signal,
      });
      return result.mid;
    } catch (err) {
      if (err instanceof UpstreamHttpError && err.kind === "not_found") return undefined;
      mapUpstreamError(err, `getMidpoint(${tokenId})`);
    }
  }

  async getPricesHistory(tokenId: string, interval: string, fidelity: number): Promise<ClobPriceHistory> {
    const url = new URL("/prices-history", this.options.baseUrl);
    url.searchParams.set("market", tokenId);
    url.searchParams.set("interval", interval);
    url.searchParams.set("fidelity", String(fidelity));
    try {
      return await fetchJson(url.toString(), {
        schema: clobPriceHistorySchema,
        timeoutMs: this.options.timeoutMs,
        signal: this.options.signal,
      });
    } catch (err) {
      mapUpstreamError(err, `getPricesHistory(${tokenId})`);
    }
  }
}
