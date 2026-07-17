import { Router } from "express";
import { snapshotRequestSchema, successEnvelope, toMarketTarget } from "@probable/schemas";
import type { GammaClient, ClobClient } from "@probable/polymarket";
import { asyncHandler } from "../middleware/error-handler.js";
import { resolveMarketTarget } from "../services/target-resolver.js";
import { buildSnapshot } from "../services/snapshot.service.js";
import { METHODOLOGY_VERSION } from "../methodology.js";

export function snapshotRouter(gamma: GammaClient, clob: ClobClient): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = snapshotRequestSchema.parse(req.body);
      const target = toMarketTarget(body.target);
      const market = await resolveMarketTarget(target, gamma);
      const data = await buildSnapshot(
        { market, outcome: body.outcome, comparisonWindows: body.comparison_windows },
        clob,
      );

      res.status(200).json(
        successEnvelope(data, {
          request_id: req.requestId,
          service: "probability_snapshot",
          methodology_version: METHODOLOGY_VERSION,
          generated_at: new Date().toISOString(),
          data_as_of: new Date().toISOString(),
          cache_status: "miss",
          limitations: [
            "Prediction-market prices are implied probabilities, not guaranteed outcomes.",
          ],
        }),
      );
    }),
  );

  return router;
}
