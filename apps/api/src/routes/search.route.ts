import { Router, type Request, type Response } from "express";
import { searchRequestSchema, successEnvelope } from "@probable/schemas";
import type { GammaClient } from "@probable/polymarket";
import { asyncHandler } from "../middleware/error-handler.js";
import { searchMarkets } from "../services/search.service.js";
import { METHODOLOGY_VERSION } from "../methodology.js";

async function handleSearch(input: unknown, gamma: GammaClient, req: Request, res: Response): Promise<void> {
  const body = searchRequestSchema.parse(input);
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
}

export function searchRouter(gamma: GammaClient): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      await handleSearch(req.body, gamma, req, res);
    }),
  );

  // Mirrors POST via query-string params. OKX's A2MCP self-check (and reachability
  // probes generally) may hit a free endpoint with a bare GET and require HTTP 200
  // back, not a 404 — see apps/api/src/config/payments.ts for the paid-route analog.
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const { query, limit, active_only } = req.query;
      await handleSearch(
        {
          query: typeof query === "string" ? query : undefined,
          limit: typeof limit === "string" ? Number(limit) : undefined,
          active_only: typeof active_only === "string" ? active_only !== "false" : undefined,
        },
        gamma,
        req,
        res,
      );
    }),
  );

  return router;
}
