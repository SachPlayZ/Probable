import { z } from "zod";
import { FINDING_SEVERITIES, FINDING_TYPES } from "@probable/domain";
import { marketTargetInputSchema } from "./market-target.js";

export const resolutionAuditRequestSchema = z
  .object({
    target: marketTargetInputSchema,
    include_edge_cases: z.boolean().default(true),
  })
  .strict();

export type ResolutionAuditRequest = z.infer<typeof resolutionAuditRequestSchema>;

export const resolutionFindingSchema = z.object({
  type: z.enum(FINDING_TYPES),
  severity: z.enum(FINDING_SEVERITIES),
  evidence: z.string(),
  explanation: z.string(),
  possible_interpretations: z.array(z.string()),
});

export type ResolutionFindingSchemaType = z.infer<typeof resolutionFindingSchema>;

/** What the LLM must return — findings only, never a score (AGENTS.md §11). */
export const resolutionFindingsLlmOutputSchema = z.object({
  findings: z.array(resolutionFindingSchema),
});

export const resolutionAuditResponseDataSchema = z.object({
  market_id: z.string(),
  market_slug: z.string().optional(),
  event_slug: z.string().optional(),
  question: z.string(),
  risk_score: z.number().min(0).max(100),
  risk_band: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  findings: z.array(resolutionFindingSchema),
  missing_information: z.array(z.string()),
  clean_resolution_requirements: z.array(z.string()),
  dropped_finding_count: z.number(),
  llm_unavailable: z.boolean(),
  disclaimer: z.string(),
});

export type ResolutionAuditResponseData = z.infer<typeof resolutionAuditResponseDataSchema>;
