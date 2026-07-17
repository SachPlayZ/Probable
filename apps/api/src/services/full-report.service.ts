import type {
  ContradictionsResponseData,
  FullReportResponseData,
  NormalizedMarket,
  ResolutionAuditResponseData,
  VitalsResponseData,
} from "@probable/schemas";
import { GammaClient, ClobClient, DataClient } from "@probable/polymarket";
import { computeSignalConfidence, computeVerdict, SIGNAL_CONFIDENCE_DISCLAIMER } from "@probable/domain";
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
}

export interface FullReportDeps {
  gamma: GammaClient;
  clob: ClobClient;
  data: DataClient;
  llm: StructuredModel;
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
  const { gamma, clob, data, llm } = deps;
  const warnings: string[] = [];
  const sectionFailures: SectionFailure[] = [];

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

  if (params.persistRequested) {
    warnings.push("Report persistence is not configured in this environment; no report_url was generated.");
  }
  if (params.socialCardRequested) {
    warnings.push("Social card generation is not configured in this environment.");
  }

  return {
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
    report_url: undefined,
    persisted: false,
    persistence_status: "not_configured",
    section_failures: sectionFailures,
    warnings,
  };
}
