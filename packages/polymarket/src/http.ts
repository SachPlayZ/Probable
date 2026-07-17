import type { ZodType, ZodTypeDef } from "zod";

export type UpstreamErrorKind =
  | "timeout"
  | "rate_limited"
  | "unavailable"
  | "not_found"
  | "client_error"
  | "invalid_schema"
  | "response_too_large";

export class UpstreamHttpError extends Error {
  kind: UpstreamErrorKind;
  status: number | undefined;

  constructor(kind: UpstreamErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB — guards against a runaway upstream payload.

function classifyStatus(status: number): UpstreamErrorKind {
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unavailable";
  return "client_error";
}

function jitteredBackoffMs(attempt: number): number {
  const base = 200 * 2 ** attempt;
  return base + Math.random() * base * 0.5;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchJsonOptions<T> {
  schema: ZodType<T, ZodTypeDef, unknown>;
  timeoutMs?: number | undefined;
  maxRetries?: number | undefined;
  signal?: AbortSignal | undefined;
  headers?: Record<string, string> | undefined;
}

/**
 * Every upstream client goes through this: fixed-shape timeout, ≤2 retries on
 * safe reads (never on 4xx/validation failures), and mandatory schema validation
 * before the caller ever sees the data (AGENTS.md §9 upstream client rules).
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions<T>): Promise<T> {
  const { schema, timeoutMs = 8000, maxRetries = 2, headers } = options;

  let lastError: UpstreamHttpError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const onParentAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onParentAbort);
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { accept: "application/json", ...headers },
      });

      if (!res.ok) {
        const kind = classifyStatus(res.status);
        const err = new UpstreamHttpError(kind, `upstream ${res.status} for ${url}`, res.status);
        if (kind === "client_error" || kind === "not_found") throw err;
        lastError = err;
        if (attempt < maxRetries) {
          await sleep(jitteredBackoffMs(attempt));
          continue;
        }
        throw err;
      }

      const contentLength = res.headers.get("content-length");
      if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
        throw new UpstreamHttpError("response_too_large", `response too large for ${url}`);
      }

      const text = await res.text();
      if (text.length > MAX_RESPONSE_BYTES) {
        throw new UpstreamHttpError("response_too_large", `response too large for ${url}`);
      }

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new UpstreamHttpError("invalid_schema", `non-JSON response from ${url}`);
      }

      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new UpstreamHttpError(
          "invalid_schema",
          `schema validation failed for ${url}: ${parsed.error.message}`,
        );
      }

      return parsed.data;
    } catch (err) {
      if (err instanceof UpstreamHttpError) {
        if (err.kind === "unavailable" || err.kind === "rate_limited") {
          lastError = err;
          if (attempt < maxRetries) {
            await sleep(jitteredBackoffMs(attempt));
            continue;
          }
        }
        throw err;
      }
      if (err instanceof Error && err.name === "AbortError") {
        lastError = new UpstreamHttpError("timeout", `timeout after ${timeoutMs}ms for ${url}`);
        if (attempt < maxRetries) {
          await sleep(jitteredBackoffMs(attempt));
          continue;
        }
        throw lastError;
      }
      throw new UpstreamHttpError(
        "unavailable",
        `network error for ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onParentAbort);
    }
  }

  throw lastError ?? new UpstreamHttpError("unavailable", `exhausted retries for ${url}`);
}
