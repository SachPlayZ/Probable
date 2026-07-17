export const FINDING_TYPES = [
  "missing_resolution_source",
  "ambiguous_deadline",
  "timezone_missing",
  "undefined_term",
  "subjective_verb",
  "conflicting_rule",
  "non_exhaustive_outcomes",
  "overlapping_outcomes",
  "edge_case_missing",
  "question_description_mismatch",
  "other",
] as const;

export type FindingType = (typeof FINDING_TYPES)[number];

export const FINDING_SEVERITIES = ["low", "medium", "high"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export interface ResolutionFinding {
  type: FindingType;
  severity: FindingSeverity;
  evidence: string;
  explanation: string;
  possible_interpretations: string[];
}

export type RiskBand = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
