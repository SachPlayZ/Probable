import { Router } from "express";
import { appError, contradictionsRequestSchema, successEnvelope, toMarketTarget } from "@probable/schemas";
import type { GammaClient, ClobClient } from "@probable/polymarket";
import { asyncHandler } from "../middleware/error-handler.js";
import { resolveMarketTarget } from "../services/target-resolver.js";
import { buildContradictionScan } from "../services/contradiction-scan.service.js";
import { METHODOLOGY_VERSION } from "../methodology.js";

export function contradictionsRouter(gamma: GammaClient, clob: ClobClient): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = contradictionsRequestSchema.parse(req.body);
      const target = toMarketTarget(body.target);

      const eventSlug =
        target.type === "eventSlug" ? target.eventSlug : (await resolveMarketTarget(target, gamma)).eventSlug;

      if (!eventSlug) {
        throw appError("MARKET_NOT_FOUND", "The resolved market is not associated with an event to scan.");
      }

      const result = await buildContradictionScan(
        { eventSlug, scanModes: body.scan_modes, minimumEdgePp: body.minimum_edge_pp },
        gamma,
        clob,
      );

      res.status(200).json(
        successEnvelope(result, {
          request_id: req.requestId,
          service: "contradiction_scan",
          methodology_version: METHODOLOGY_VERSION,
          generated_at: new Date().toISOString(),
          data_as_of: new Date().toISOString(),
          cache_status: "miss",
          limitations: [
            "Findings are candidate inconsistencies requiring manual verification, never guaranteed arbitrage or certain mispricing.",
          ],
        }),
      );
    }),
  );

  return router;
}
