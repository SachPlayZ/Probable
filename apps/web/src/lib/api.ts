import { fullReportResponseDataSchema, type FullReportResponseData } from "@probable/schemas";
import { z } from "zod";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

const reportEnvelopeSchema = z.object({
  ok: z.literal(true),
  data: fullReportResponseDataSchema,
  meta: z.object({
    request_id: z.string().optional(),
    methodology_version: z.string().optional(),
    generated_at: z.string().optional(),
    data_as_of: z.string().optional(),
  }),
});

export type ReportEnvelope = z.infer<typeof reportEnvelopeSchema>;

/** Never trust our own API response shape blindly — validate like any other boundary. */
export async function getReport(publicId: string): Promise<ReportEnvelope | undefined> {
  const res = await fetch(`${API_URL}/v1/reports/${encodeURIComponent(publicId)}`, {
    cache: "no-store",
  });
  if (!res.ok) return undefined;

  const json: unknown = await res.json();
  const parsed = reportEnvelopeSchema.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}

export type { FullReportResponseData };
