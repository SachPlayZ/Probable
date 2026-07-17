import { z } from "zod";

export const upstreamStatusSchema = z.object({
  name: z.enum(["gamma", "clob", "data"]),
  fetchedAt: z.string(),
  status: z.enum(["ok", "partial", "failed"]),
});

export const analysisMetadataSchema = z.object({
  requestId: z.string(),
  service: z.string(),
  methodologyVersion: z.string(),
  generatedAt: z.string(),
  dataAsOf: z.string(),
  cacheStatus: z.enum(["hit", "miss", "stale-fallback"]),
  upstreams: z.array(upstreamStatusSchema),
  limitations: z.array(z.string()),
});

export type AnalysisMetadata = z.infer<typeof analysisMetadataSchema>;
export type UpstreamStatus = z.infer<typeof upstreamStatusSchema>;
