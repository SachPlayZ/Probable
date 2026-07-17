import {
  resolutionFindingsLlmOutputSchema,
  type NormalizedMarket,
  type ResolutionAuditResponseData,
  type ResolutionFindingSchemaType,
} from "@probable/schemas";
import { computeResolutionRisk, verifyFindingsEvidence, type ResolutionFinding } from "@probable/domain";
import { LlmOutputInvalidError, LlmUnavailableError, type StructuredModel } from "../llm/structured-model.js";

const NONE_PROVIDED = "(none provided)";
const DISCLAIMER =
  "This is a language audit of the market's stated rules, not a legal judgment or a prediction of Polymarket's final resolution decision.";

function buildAuditText(market: NormalizedMarket, siblingQuestions: string[]): string {
  return [
    `Question: ${market.question}`,
    `Description: ${market.description || NONE_PROVIDED}`,
    `Resolution Source: ${market.resolutionSource || NONE_PROVIDED}`,
    `End Date: ${market.endDate || NONE_PROVIDED}`,
    `Outcomes: ${market.outcomes.map((o) => o.name).join(", ") || NONE_PROVIDED}`,
    `Sibling markets in the same event: ${siblingQuestions.length > 0 ? siblingQuestions.join("; ") : "(none)"}`,
  ].join("\n");
}

function deterministicFindings(market: NormalizedMarket): ResolutionFinding[] {
  const findings: ResolutionFinding[] = [];
  if (!market.resolutionSource) {
    findings.push({
      type: "missing_resolution_source",
      severity: "high",
      evidence: NONE_PROVIDED,
      explanation: "No resolution source was provided for this market.",
      possible_interpretations: [],
    });
  }
  if (!market.endDate) {
    findings.push({
      type: "ambiguous_deadline",
      severity: "high",
      evidence: NONE_PROVIDED,
      explanation: "No end date was provided for this market.",
      possible_interpretations: [],
    });
  }
  return findings;
}

const REQUIREMENT_BY_TYPE: Partial<Record<ResolutionFinding["type"], string>> = {
  missing_resolution_source: "Provide an explicit, named resolution source.",
  ambiguous_deadline: "State an exact resolution deadline, including date and time.",
  timezone_missing: "Specify the timezone for the resolution deadline.",
  undefined_term: "Define the decisive term(s) used in the resolution criteria.",
  subjective_verb: "Replace subjective language with an objectively verifiable condition.",
  conflicting_rule: "Resolve the conflict between the market's stated rules.",
  non_exhaustive_outcomes: "Ensure the outcome set covers every possible real-world result.",
  overlapping_outcomes: "Ensure outcomes are mutually exclusive.",
  edge_case_missing: "Address the missing edge case explicitly in the rules.",
  question_description_mismatch: "Align the question text and description.",
};

function cleanResolutionRequirements(findings: ResolutionFinding[]): string[] {
  const requirements = new Set<string>();
  for (const finding of findings) {
    const requirement = REQUIREMENT_BY_TYPE[finding.type];
    if (requirement) requirements.add(requirement);
  }
  return [...requirements];
}

export interface ResolutionAuditParams {
  market: NormalizedMarket;
  siblingQuestions: string[];
  includeEdgeCases: boolean;
}

export async function buildResolutionAudit(
  params: ResolutionAuditParams,
  llm: StructuredModel,
): Promise<ResolutionAuditResponseData> {
  const { market, siblingQuestions, includeEdgeCases } = params;
  const sourceText = buildAuditText(market, siblingQuestions);

  const detFindings = deterministicFindings(market);

  let llmFindings: ResolutionFindingSchemaType[] = [];
  let droppedCount = 0;
  let llmUnavailable = false;

  const task = [
    "Read the market text below and identify resolution-language risks.",
    "Look for: missing/ambiguous resolution source, ambiguous or conflicting deadlines,",
    "missing timezone, undefined decisive terms, subjective decisive verbs, conflicting rules,",
    "non-exhaustive or overlapping outcomes, and a mismatch between the question and description.",
    includeEdgeCases
      ? "Also flag any plausible real-world edge case the rules do not address."
      : "Do not flag missing edge cases.",
    "Every finding's `evidence` field must be an exact, verbatim substring of the supplied text.",
    "If you find nothing, return an empty findings array — never invent a finding.",
  ].join(" ");

  try {
    const result = await llm.generate({
      task,
      schema: resolutionFindingsLlmOutputSchema,
      data: sourceText,
      timeoutMs: 15_000,
    });
    const { verified, dropped } = verifyFindingsEvidence(result.findings, sourceText);
    llmFindings = verified;
    droppedCount = dropped.length;
  } catch (err) {
    if (err instanceof LlmUnavailableError || err instanceof LlmOutputInvalidError) {
      llmUnavailable = true;
    } else {
      throw err;
    }
  }

  const allFindings = [...detFindings, ...llmFindings];
  const risk = computeResolutionRisk(allFindings);

  const missingInformation: string[] = [];
  if (!market.resolutionSource) missingInformation.push("resolution_source");
  if (!market.endDate) missingInformation.push("end_date");
  if (!market.description) missingInformation.push("description");

  return {
    market_id: market.marketId,
    market_slug: market.marketSlug,
    event_slug: market.eventSlug,
    question: market.question,
    risk_score: risk.score,
    risk_band: risk.band,
    findings: allFindings,
    missing_information: missingInformation,
    clean_resolution_requirements: cleanResolutionRequirements(allFindings),
    dropped_finding_count: droppedCount,
    llm_unavailable: llmUnavailable,
    disclaimer: DISCLAIMER,
  };
}
