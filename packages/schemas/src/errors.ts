export const ERROR_CODES = [
  "INVALID_REQUEST",
  "INVALID_TARGET",
  "MARKET_NOT_FOUND",
  "AMBIGUOUS_MARKET",
  "MARKET_NOT_ORDERBOOK_ENABLED",
  "INSUFFICIENT_MARKET_DATA",
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_RATE_LIMITED",
  "UPSTREAM_SCHEMA_CHANGED",
  "UPSTREAM_UNAVAILABLE",
  "PAYMENT_REQUIRED",
  "PAYMENT_INVALID",
  "LLM_OUTPUT_INVALID",
  "REPORT_PERSISTENCE_FAILED",
  "IDEMPOTENCY_CONFLICT",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface AppErrorShape {
  code: ErrorCode;
  message: string;
  status: number;
  retryable: boolean;
  details: Record<string, unknown> | undefined;
  cause?: unknown;
}

export class AppError extends Error implements AppErrorShape {
  code: ErrorCode;
  status: number;
  retryable: boolean;
  details: Record<string, unknown> | undefined;
  override cause?: unknown;

  constructor(shape: Omit<AppErrorShape, "message"> & { message: string }) {
    super(shape.message);
    this.code = shape.code;
    this.status = shape.status;
    this.retryable = shape.retryable;
    this.details = shape.details;
    this.cause = shape.cause;
  }
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  INVALID_TARGET: 400,
  MARKET_NOT_FOUND: 404,
  AMBIGUOUS_MARKET: 409,
  MARKET_NOT_ORDERBOOK_ENABLED: 422,
  INSUFFICIENT_MARKET_DATA: 422,
  UPSTREAM_TIMEOUT: 504,
  UPSTREAM_RATE_LIMITED: 429,
  UPSTREAM_SCHEMA_CHANGED: 502,
  UPSTREAM_UNAVAILABLE: 502,
  PAYMENT_REQUIRED: 402,
  PAYMENT_INVALID: 402,
  LLM_OUTPUT_INVALID: 502,
  REPORT_PERSISTENCE_FAILED: 500,
  IDEMPOTENCY_CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

const RETRYABLE_CODES: ReadonlySet<ErrorCode> = new Set([
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_RATE_LIMITED",
  "UPSTREAM_UNAVAILABLE",
]);

export function appError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: unknown,
): AppError {
  return new AppError({
    code,
    message,
    status: STATUS_BY_CODE[code],
    retryable: RETRYABLE_CODES.has(code),
    details,
    cause,
  });
}
