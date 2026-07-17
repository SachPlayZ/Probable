import pino, { type Logger } from "pino";

/**
 * AGENTS.md §22: never log payment signatures, authorization payloads, private keys,
 * API secrets, or full headers. Redact by key wherever they might appear in a log object.
 */
const REDACT_PATHS = [
  "headers",
  "headers.authorization",
  "headers['x-payment']",
  "headers['payment-signature']",
  "headers['payment-required']",
  "req.headers",
  "req.headers.authorization",
  "req.headers['x-payment']",
  "req.headers['payment-signature']",
  "req.headers['payment-required']",
  "*.headers",
  "authorization",
  "paymentSignature",
  "authorizationHeader",
  "privateKey",
  "apiSecret",
  "apiPassphrase",
  "*.paymentSignature",
  "*.authorizationHeader",
  "*.privateKey",
  "*.apiSecret",
  "*.apiPassphrase",
];

export interface CreateLoggerOptions {
  level?: string;
  service: string;
  /** Injectable for tests; defaults to stdout. */
  destination?: NodeJS.WritableStream;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const opts = {
    level: options.level ?? "info",
    base: { service: options.service },
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  return options.destination ? pino(opts, options.destination) : pino(opts);
}

export function withRequestId(logger: Logger, requestId: string): Logger {
  return logger.child({ requestId });
}

export type { Logger };
