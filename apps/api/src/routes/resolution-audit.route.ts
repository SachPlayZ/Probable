import { Router } from "express";
import { resolutionAuditRequestSchema, successEnvelope, toMarketTarget } from "@probable/schemas";
import type { GammaClient } from "@probable/polymarket";
import { asyncHandler } from "../middleware/error-handler.js";
import { resolveMarketTarget } from "../services/target-resolver.js";
import { buildResolutionAudit } from "../services/resolution-audit.service.js";
import type { StructuredModel } from "../llm/structured-model.js";
import { METHODOLOGY_VERSION } from "../methodology.js";

export function resolutionAuditRouter(gamma: GammaClient, llm: StructuredModel): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = resolutionAuditRequestSchema.parse(req.body);
      const target = toMarketTarget(body.target);
      const market = await resolveMarketTarget(target, gamma);

      let siblingQuestions: string[] = [];
      if (market.eventSlug) {
        const event = await gamma.getEventBySlug(market.eventSlug);
        siblingQuestions = (event?.markets ?? [])
          .filter((m) => m.id !== market.marketId)
          .map((m) => m.question);
      }

      const result = await buildResolutionAudit(
        { market, siblingQuestions, includeEdgeCases: body.include_edge_cases },
        llm,
      );

      res.status(200).json(
        successEnvelope(result, {
          request_id: req.requestId,
          service: "resolution_guard",
          methodology_version: METHODOLOGY_VERSION,
          generated_at: new Date().toISOString(),
          data_as_of: new Date().toISOString(),
          cache_status: "miss",
          limitations: [
            "This is a language audit, not a legal judgment or prediction of Polymarket's final decision.",
            ...(result.llm_unavailable
              ? ["LLM-based findings are unavailable right now; only deterministic checks were applied."]
              : []),
          ],
        }),
      );
    }),
  );

  return router;
}
