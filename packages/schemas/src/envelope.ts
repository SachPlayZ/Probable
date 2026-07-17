import { z } from "zod";
import { ERROR_CODES } from "./errors.js";

export const responseMetaSchema = z.object({
  request_id: z.string(),
  service: z.string().optional(),
  methodology_version: z.string().optional(),
  generated_at: z.string().optional(),
  data_as_of: z.string().optional(),
  cache_status: z.enum(["hit", "miss", "stale-fallback"]).optional(),
  limitations: z.array(z.string()).optional(),
});

export function successEnvelope<T>(data: T, meta: Record<string, unknown>) {
  return { ok: true as const, data, meta };
}

export function errorEnvelope(
  code: (typeof ERROR_CODES)[number],
  message: string,
  requestId: string,
  retryable: boolean,
  details?: Record<string, unknown>,
) {
  return {
    ok: false as const,
    error: { code, message, retryable, details: details ?? {} },
    meta: { request_id: requestId },
  };
}
