import type { ResolutionFinding } from "./types.js";

/** Evidence must be an exact, locatable span of the supplied text — never trusted blindly. */
export function evidenceExistsIn(sourceText: string, evidence: string): boolean {
  if (evidence.length === 0) return false;
  return sourceText.includes(evidence);
}

export interface EvidenceVerification {
  verified: ResolutionFinding[];
  dropped: ResolutionFinding[];
}

/** Findings whose evidence can't be located are dropped, never surfaced (AGENTS.md §11). */
export function verifyFindingsEvidence(findings: ResolutionFinding[], sourceText: string): EvidenceVerification {
  const verified: ResolutionFinding[] = [];
  const dropped: ResolutionFinding[] = [];
  for (const finding of findings) {
    if (evidenceExistsIn(sourceText, finding.evidence)) {
      verified.push(finding);
    } else {
      dropped.push(finding);
    }
  }
  return { verified, dropped };
}
