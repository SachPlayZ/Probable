import { Router } from "express";
import { vitalsRequestSchema, successEnvelope, toMarketTarget } from "@probable/schemas";
import type { GammaClient, ClobClient, DataClient } from "@probable/polymarket";
import { asyncHandler } from "../middleware/error-handler.js";
import { resolveMarketTarget } from "../services/target-resolver.js";
import { buildVitals } from "../services/vitals.service.js";
import { METHODOLOGY_VERSION } from "../methodology.js";

export function vitalsRouter(gamma: GammaClient, clob: ClobClient, data: DataClient): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = vitalsRequestSchema.parse(req.body);
      const target = toMarketTarget(body.target);
      const market = await resolveMarketTarget(target, gamma);
      const result = await buildVitals(
        {
          market,
          outcome: body.outcome,
          tradeSizesUsd: body.trade_sizes_usd,
          depthBands: body.depth_bands,
        },
        clob,
        data,
      );

      res.status(200).json(
        successEnvelope(result, {
          request_id: req.requestId,
          service: "market_vitals",
          methodology_version: METHODOLOGY_VERSION,
          generated_at: new Date().toISOString(),
          data_as_of: new Date().toISOString(),
          cache_status: "miss",
          limitations: [
            "Prediction-market prices are implied probabilities, not guaranteed outcomes.",
            "Market quality is a transparent heuristic, not a promise of market correctness.",
          ],
        }),
      );
    }),
  );

  return router;
}
