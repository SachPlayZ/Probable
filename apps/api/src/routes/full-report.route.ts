import { Router } from "express";
import { fullReportRequestSchema, successEnvelope, toMarketTarget } from "@probable/schemas";
import type { GammaClient, ClobClient, DataClient } from "@probable/polymarket";
import { asyncHandler } from "../middleware/error-handler.js";
import { resolveMarketTarget } from "../services/target-resolver.js";
import { buildFullReport } from "../services/full-report.service.js";
import type { StructuredModel } from "../llm/structured-model.js";
import { METHODOLOGY_VERSION } from "../methodology.js";

export function fullReportRouter(gamma: GammaClient, clob: ClobClient, data: DataClient, llm: StructuredModel): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = fullReportRequestSchema.parse(req.body);
      const target = toMarketTarget(body.target);
      const market = await resolveMarketTarget(target, gamma);

      const result = await buildFullReport(
        {
          market,
          outcome: body.outcome,
          tradeSizesUsd: body.trade_sizes_usd,
          persistRequested: body.persist_report,
          socialCardRequested: body.generate_social_card,
        },
        { gamma, clob, data, llm },
      );

      res.status(200).json(
        successEnvelope(result, {
          request_id: req.requestId,
          service: "full_intelligence_report",
          methodology_version: METHODOLOGY_VERSION,
          generated_at: new Date().toISOString(),
          data_as_of: new Date().toISOString(),
          cache_status: "miss",
          limitations: [
            "Prediction-market prices are implied probabilities, not guaranteed outcomes.",
            "Signal confidence measures market signal quality, not certainty of the real-world outcome.",
          ],
        }),
      );
    }),
  );

  return router;
}
