import { z } from "zod";
import { marketTargetInputSchema } from "./market-target.js";
import { snapshotResponseDataSchema } from "./snapshot.js";
import { vitalsResponseDataSchema } from "./vitals.js";
import { resolutionAuditResponseDataSchema } from "./resolution-audit.js";
import { contradictionsResponseDataSchema } from "./contradictions.js";

export const fullReportRequestSchema = z
  .object({
    target: marketTargetInputSchema,
    outcome: z.string().min(1).max(100).default("Yes"),
    trade_sizes_usd: z.array(z.number().positive()).min(1).max(5).default([100, 500]),
    persist_report: z.boolean().default(true),
    generate_social_card: z.boolean().default(false),
    idempotency_key: z.string().min(1).max(200).optional(),
  })
  .strict();

export type FullReportRequest = z.infer<typeof fullReportRequestSchema>;

export const verdictSchema = z.enum([
  "RULES_RISK_DOMINATES",
  "WEAK_MARKET_SIGNAL",
  "RELATED_MARKETS_DISAGREE",
  "STRONGER_MARKET_SIGNAL",
  "USE_WITH_CONTEXT",
]);

export const signalConfidenceSchema = z.object({
  score: z.number().min(0).max(100),
  grade: z.enum(["HIGH", "MODERATE", "LOW", "VERY_LOW"]),
  disclaimer: z.string(),
});

export const fullReportResponseDataSchema = z.object({
  market_id: z.string(),
  market_slug: z.string().optional(),
  event_slug: z.string().optional(),
  question: z.string(),
  verdict: verdictSchema,
  signal_confidence: signalConfidenceSchema,
  snapshot: snapshotResponseDataSchema,
  vitals: vitalsResponseDataSchema.optional(),
  resolution_audit: resolutionAuditResponseDataSchema.optional(),
  contradictions: contradictionsResponseDataSchema.optional(),
  report_url: z.string().optional(),
  persisted: z.boolean(),
  persistence_status: z.enum(["persisted", "not_configured", "failed"]),
  section_failures: z.array(z.object({ section: z.string(), reason: z.string() })),
  warnings: z.array(z.string()),
});

export type FullReportResponseData = z.infer<typeof fullReportResponseDataSchema>;
