export { ERROR_CODES, AppError, appError } from "./errors.js";
export type { ErrorCode, AppErrorShape } from "./errors.js";

export { marketTargetInputSchema, toMarketTarget } from "./market-target.js";
export type { MarketTarget, MarketTargetInput } from "./market-target.js";

export { normalizedMarketSchema, marketOutcomeSchema, marketStatusSchema } from "./normalized-market.js";
export type { NormalizedMarket, MarketOutcome } from "./normalized-market.js";

export { analysisMetadataSchema, upstreamStatusSchema } from "./analysis-metadata.js";
export type { AnalysisMetadata, UpstreamStatus } from "./analysis-metadata.js";

export { responseMetaSchema, successEnvelope, errorEnvelope } from "./envelope.js";

export { searchRequestSchema, searchMatchSchema, searchResponseDataSchema } from "./search.js";
export type { SearchRequest, SearchMatch, SearchResponseData } from "./search.js";

export { snapshotRequestSchema, snapshotResponseDataSchema, pricingMethodSchema } from "./snapshot.js";
export type { SnapshotRequest, SnapshotResponseData } from "./snapshot.js";

export { vitalsRequestSchema, vitalsResponseDataSchema } from "./vitals.js";
export type { VitalsRequest, VitalsResponseData } from "./vitals.js";

export {
  resolutionAuditRequestSchema,
  resolutionFindingSchema,
  resolutionFindingsLlmOutputSchema,
  resolutionAuditResponseDataSchema,
} from "./resolution-audit.js";
export type {
  ResolutionAuditRequest,
  ResolutionFindingSchemaType,
  ResolutionAuditResponseData,
} from "./resolution-audit.js";

export {
  scanModeSchema,
  contradictionsRequestSchema,
  contradictionCandidateSchema,
  contradictionsResponseDataSchema,
} from "./contradictions.js";
export type {
  ContradictionsRequest,
  ContradictionCandidate,
  ContradictionsResponseData,
} from "./contradictions.js";

export {
  fullReportRequestSchema,
  fullReportResponseDataSchema,
  verdictSchema,
  signalConfidenceSchema,
} from "./full-report.js";
export type { FullReportRequest, FullReportResponseData } from "./full-report.js";
