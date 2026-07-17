import { Router } from "express";
import { searchRequestSchema, successEnvelope } from "@probable/schemas";
import type { GammaClient } from "@probable/polymarket";
import { asyncHandler } from "../middleware/error-handler.js";
import { searchMarkets } from "../services/search.service.js";
import { METHODOLOGY_VERSION } from "../methodology.js";

export function searchRouter(gamma: GammaClient): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = searchRequestSchema.parse(req.body);
      const data = await searchMarkets(
        { query: body.query, limit: body.limit, activeOnly: body.active_only },
        gamma,
      );

      res.status(200).json(
        successEnvelope(data, {
          request_id: req.requestId,
          service: "market_search",
          methodology_version: METHODOLOGY_VERSION,
          generated_at: new Date().toISOString(),
          cache_status: "miss",
          limitations: [
            "Semantic similarity currently uses lexical token overlap; LLM-based reranking is a later enhancement.",
          ],
        }),
      );
    }),
  );

  return router;
}
