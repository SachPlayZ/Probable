import { Router } from "express";
import type { AppConfig } from "@probable/config";

/**
 * A2MCP discovery manifest at the conventional agent-discovery path. Never
 * payment-protected — a reviewer/buyer must be able to fetch this before it
 * knows which operations exist or what they cost (AGENTS.md §12: prices/
 * endpoints sourced only from config.routes, never hardcoded here).
 */
export function wellKnownRouter(config: AppConfig): Router {
  const router = Router();

  router.get("/agent.json", (_req, res) => {
    const origin = config.publicApiUrl.replace(/\/+$/, "");
    const routes = config.routes;

    res.status(200).json({
      name: "Probable",
      description:
        "Probable gives AI agents a live, financially-backed prior for any future-looking question — real-time Polymarket odds and market intelligence for news prioritization, financial research, sports previews, political analysis, risk monitoring, content generation, and event forecasting.",
      access: "permissionless",
      pricing: "mixed",
      protocols: {
        a2mcp: {
          operations: {
            marketSearch: {
              endpoint: `${origin}${routes.search.path}`,
              method: "POST",
              price: "free",
              description: routes.search.description,
            },
            probabilitySnapshot: {
              endpoint: `${origin}${routes.snapshot.path}`,
              method: "POST",
              price: routes.snapshot.price,
              description: routes.snapshot.description,
            },
            marketVitals: {
              endpoint: `${origin}${routes.vitals.path}`,
              method: "POST",
              price: routes.vitals.price,
              description: routes.vitals.description,
            },
            resolutionGuard: {
              endpoint: `${origin}${routes.resolution_audit.path}`,
              method: "POST",
              price: routes.resolution_audit.price,
              description: routes.resolution_audit.description,
            },
            contradictionScan: {
              endpoint: `${origin}${routes.contradictions.path}`,
              method: "POST",
              price: routes.contradictions.price,
              description: routes.contradictions.description,
            },
            fullIntelligenceReport: {
              endpoint: `${origin}${routes.full_report.path}`,
              method: "POST",
              price: routes.full_report.price,
              description: routes.full_report.description,
            },
          },
        },
      },
    });
  });

  return router;
}
