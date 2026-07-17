import { Router } from "express";

export function healthRouter(): Router {
  const router = Router();

  // No external calls — process-alive check only (AGENTS.md §22 health-endpoint rule).
  router.get("/live", (_req, res) => {
    res.status(200).json({ ok: true, data: { status: "live" }, meta: {} });
  });

  return router;
}
