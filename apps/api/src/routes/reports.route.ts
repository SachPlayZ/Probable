import { Router } from "express";
import { appError, successEnvelope } from "@probable/schemas";
import type { ReportsRepository } from "@probable/db";
import { asyncHandler } from "../middleware/error-handler.js";
import { METHODOLOGY_VERSION } from "../methodology.js";

/** Free, read-only — a persisted report is public data once created with persist_report:true. */
export function reportsRouter(reportsRepo: ReportsRepository | undefined): Router {
  const router = Router();

  router.get(
    "/:publicId",
    asyncHandler(async (req, res) => {
      if (!reportsRepo) {
        throw appError("REPORT_NOT_FOUND", "Report persistence is not configured on this deployment.");
      }

      const report = await reportsRepo.findByPublicId(req.params.publicId!);
      if (!report || !report.isPublic) {
        throw appError("REPORT_NOT_FOUND", "No public report was found for this ID.");
      }

      res.status(200).json(
        successEnvelope(report.resultPayload, {
          request_id: req.requestId,
          service: report.service,
          methodology_version: report.methodologyVersion ?? METHODOLOGY_VERSION,
          generated_at: report.generatedAt,
          data_as_of: report.dataAsOf,
          cache_status: "hit",
          limitations: [],
        }),
      );
    }),
  );

  return router;
}
