import type { ZodType } from "zod";

export interface GenerateInput<T> {
  task: string;
  schema: ZodType<T>;
  data: unknown;
  timeoutMs: number;
}

/**
 * Provider-agnostic per PLAN.md §18 — domain and route code depend only on this,
 * never on a specific AI SDK (AGENTS.md §11: "Do not couple domain modules to one
 * AI provider").
 */
export interface StructuredModel {
  generate<T>(input: GenerateInput<T>): Promise<T>;
}

export class LlmOutputInvalidError extends Error {
  constructor(message: string, override readonly cause?: unknown) {
    super(message);
  }
}

export class LlmUnavailableError extends Error {
  constructor(message: string, override readonly cause?: unknown) {
    super(message);
  }
}

/** Used when no LLM API key is configured — fails fast and honestly rather than attempting a call. */
export class UnavailableStructuredModel implements StructuredModel {
  async generate<T>(): Promise<T> {
    throw new LlmUnavailableError("No LLM provider is configured.");
  }
}
