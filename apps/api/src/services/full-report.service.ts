import { appError, fullReportResponseDataSchema, type FullReportResponseData, type NormalizedMarket, type ResolutionAuditResponseData, type ContradictionsResponseData, type VitalsResponseData } from "@probable/schemas";
import { GammaClient, ClobClient, DataClient } from "@probable/polymarket";
import { computeSignalConfidence, computeVerdict, SIGNAL_CONFIDENCE_DISCLAIMER } from "@probable/domain";
import type { ReportsRepository } from "@probable/db";
import type { StructuredModel } from "../llm/structured-model.js";
import { buildSnapshot } from "./snapshot.service.js";
import { buildVitals } from "./vitals.service.js";
import { buildResolutionAudit } from "./resolution-audit.service.js";
import { buildContradictionScan } from "./contradiction-scan.service.js";

export interface FullReportParams {
  market: NormalizedMarket;
  outcome: string;
  tradeSizesUsd: number[];
  persistRequested: boolean;
  socialCardRequested: boolean;
  requestHash: string;
  idempotencyKey: string | undefined;
  publicWebUrl: string;
}

export interface FullReportDeps {
  gamma: GammaClient;
  clob: ClobClient;
  data: DataClient;
  llm: StructuredModel;
  reportsRepo: ReportsRepository | undefined;
}

interface SectionFailure {
  section: string;
  reason: string;
}

function clamp0to100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export async function buildFullReport(
  params: FullReportParams,
  deps: FullReportDeps,
): Promise<FullReportResponseData> {
  const { market, outcome, tradeSizesUsd } = params;
  const { gamma, clob, data, llm, reportsRepo } = deps;
  const warnings: string[] = [];
  const sectionFailures: SectionFailure[] = [];

  // PLAN.md §13 idempotency: same key + same payload hash → same cached report;
  // same key + a different payload hash → 409 IDEMPOTENCY_CONFLICT.
  if (params.idempotencyKey && reportsRepo) {
    const existing = await reportsRepo.findByIdempotencyKey(params.idempotencyKey);
    if (existing) {
      if (existing.requestHash !== params.requestHash) {
        throw appError("IDEMPOTENCY_CONFLICT", "This idempotency_key was already used with a different request payload.");
      }
      const cached = fullReportResponseDataSchema.safeParse(existing.resultPayload);
      if (cached.success) {
        // report_url depends on the DB-generated public_id, which doesn't exist yet at the
        // time the cached payload was stored — always derive it fresh from the found row.
        return {
          ...cached.data,
          report_url: `${params.publicWebUrl}/reports/${existing.publicId}`,
          persisted: true,
          persistence_status: "persisted",
        };
      }
      // Stored payload predates a schema change — fall through and regenerate rather than error.
    }
  }

  // Snapshot is the critical section — its failure fails the whole report; every
  // other section degrades gracefully (AGENTS.md §23 partial-upstream-failure rule).
  const snapshot = await buildSnapshot({ market, outcome, comparisonWindows: ["1h", "24h", "7d"] }, clob);

  let vitals: VitalsResponseData | undefined;
  try {
    vitals = await buildVitals({ market, outcome, tradeSizesUsd, depthBands: [0.01, 0.03, 0.05] }, clob, data);
  } catch (err) {
    sectionFailures.push({ section: "vitals", reason: err instanceof Error ? err.message : String(err) });
  }

  let resolutionAudit: ResolutionAuditResponseData | undefined;
  try {
    let siblingQuestions: string[] = [];
    if (market.eventSlug) {
      const event = await gamma.getEventBySlug(market.eventSlug);
      siblingQuestions = (event?.markets ?? []).filter((m) => m.id !== market.marketId).map((m) => m.question);
    }
    resolutionAudit = await buildResolutionAudit({ market, siblingQuestions, includeEdgeCases: true }, llm);
  } catch (err) {
    sectionFailures.push({ section: "resolution_audit", reason: err instanceof Error ? err.message : String(err) });
  }

  let contradictions: ContradictionsResponseData | undefined;
  if (market.eventSlug) {
    try {
      contradictions = await buildContradictionScan(
        { eventSlug: market.eventSlug, scanModes: ["multi_outcome_sum", "near_duplicate"], minimumEdgePp: 3 },
        gamma,
        clob,
      );
    } catch (err) {
      sectionFailures.push({ section: "contradictions", reason: err instanceof Error ? err.message : String(err) });
    }
  } else {
    warnings.push("This market has no associated event; contradiction scanning was skipped.");
  }

  const marketQuality = vitals?.quality_score ?? 50;
  const resolutionRisk = resolutionAudit?.risk_score ?? 50;
  if (!vitals) warnings.push("Market Vitals were unavailable; market quality defaulted to a neutral value for scoring.");
  if (!resolutionAudit) {
    warnings.push("Resolution Guard was unavailable; resolution risk defaulted to a neutral value for scoring.");
  }

  const highConfidenceContradictions = contradictions?.candidates.filter((c) => c.confidence === "high").length ?? 0;
  const relatedMarketAgreement =
    contradictions && contradictions.candidates.length > 0
      ? clamp0to100(100 - highConfidenceContradictions * 25)
      : 50;

  const verdict = computeVerdict({
    resolutionRisk,
    marketQuality,
    highConfidenceContradictionCount: highConfidenceContradictions,
  });

  const signalConfidence = computeSignalConfidence({
    marketQuality,
    resolutionRisk,
    relatedMarketAgreement,
  });

  if (params.socialCardRequested) {
    warnings.push("Social card generation is not configured in this environment.");
  }

  const reportBase: Omit<FullReportResponseData, "report_url" | "persisted" | "persistence_status"> = {
    market_id: market.marketId,
    market_slug: market.marketSlug,
    event_slug: market.eventSlug,
    question: market.question,
    verdict,
    signal_confidence: {
      score: signalConfidence.score,
      grade: signalConfidence.grade,
      disclaimer: SIGNAL_CONFIDENCE_DISCLAIMER,
    },
    snapshot,
    vitals,
    resolution_audit: resolutionAudit,
    contradictions,
    section_failures: sectionFailures,
    warnings,
  };

  if (!params.persistRequested) {
    return { ...reportBase, report_url: undefined, persisted: false, persistence_status: "not_configured" };
  }

  if (!reportsRepo) {
    return {
      ...reportBase,
      warnings: [...warnings, "Report persistence is not configured in this environment; no report_url was generated."],
      report_url: undefined,
      persisted: false,
      persistence_status: "not_configured",
    };
  }

  // A persistence failure must not corrupt an otherwise-valid paid response
  // (AGENTS.md §15) — degrade to an unpersisted report rather than throwing.
  try {
    const finalPayload = { ...reportBase, report_url: undefined, persisted: true, persistence_status: "persisted" as const };
    const persisted = await reportsRepo.create({
      service: "full_report",
      requestHash: params.requestHash,
      idempotencyKey: params.idempotencyKey,
      requestPayload: { market_id: market.marketId, outcome, trade_sizes_usd: tradeSizesUsd },
      resultPayload: finalPayload,
      methodologyVersion: "1.0.0",
      marketId: market.marketId,
      eventId: market.eventId,
      dataAsOf: new Date(),
      generatedAt: new Date(),
      isPublic: true,
    });
    return { ...finalPayload, report_url: `${params.publicWebUrl}/reports/${persisted.publicId}` };
  } catch (err) {
    return {
      ...reportBase,
      warnings: [...warnings, `Report persistence failed: ${err instanceof Error ? err.message : String(err)}`],
      report_url: undefined,
      persisted: false,
      persistence_status: "failed",
    };
  }
}
