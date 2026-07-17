import { z } from "zod";
import { marketTargetInputSchema } from "./market-target.js";

export const scanModeSchema = z.enum(["multi_outcome_sum", "logical_implication", "near_duplicate"]);

export const contradictionsRequestSchema = z
  .object({
    target: marketTargetInputSchema,
    scan_modes: z.array(scanModeSchema).min(1).default(["multi_outcome_sum", "near_duplicate"]),
    minimum_edge_pp: z.number().positive().default(3),
  })
  .strict();

export type ContradictionsRequest = z.infer<typeof contradictionsRequestSchema>;

export const contradictionCandidateSchema = z.object({
  type: z.enum(["multi_outcome_sum", "near_duplicate"]),
  market_ids: z.array(z.string()),
  questions: z.array(z.string()),
  probabilities_percent: z.array(z.string()),
  discrepancy_pp: z.string(),
  relationship: z.string(),
  why_may_fail: z.string(),
  buffer_pp: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  manual_checks_required: z.array(z.string()),
});

export type ContradictionCandidate = z.infer<typeof contradictionCandidateSchema>;

export const contradictionsResponseDataSchema = z.object({
  event_slug: z.string().optional(),
  event_title: z.string().optional(),
  scan_modes_run: z.array(scanModeSchema),
  candidates: z.array(contradictionCandidateSchema),
  warnings: z.array(z.string()),
});

export type ContradictionsResponseData = z.infer<typeof contradictionsResponseDataSchema>;
