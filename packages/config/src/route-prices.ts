export const SERVICE_IDS = [
  "search",
  "snapshot",
  "vitals",
  "resolution_audit",
  "contradictions",
  "full_report",
] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];
