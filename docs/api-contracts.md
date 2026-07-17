# API Contracts

Generated from the actual Zod schemas in `packages/schemas/src/` — this
documents what's really implemented, not an aspiration. If this drifts from
the schemas, the schemas win; regenerate this doc rather than trust it blindly.

All routes are versioned under `/v1`. All responses use the common envelope:

```json
// success
{ "ok": true, "data": { /* per-route below */ }, "meta": { "request_id": "...", "service": "...", "methodology_version": "1.0.0", "generated_at": "...", "data_as_of": "...", "cache_status": "hit|miss|stale-fallback", "limitations": ["..."] } }

// error
{ "ok": false, "error": { "code": "MARKET_NOT_FOUND", "message": "...", "retryable": false, "details": {} }, "meta": { "request_id": "..." } }
```

Error codes: `INVALID_REQUEST`, `INVALID_TARGET`, `MARKET_NOT_FOUND`,
`AMBIGUOUS_MARKET`, `MARKET_NOT_ORDERBOOK_ENABLED`, `INSUFFICIENT_MARKET_DATA`,
`UPSTREAM_TIMEOUT`, `UPSTREAM_RATE_LIMITED`, `UPSTREAM_SCHEMA_CHANGED`,
`UPSTREAM_UNAVAILABLE`, `PAYMENT_REQUIRED`, `PAYMENT_INVALID`,
`LLM_OUTPUT_INVALID`, `REPORT_PERSISTENCE_FAILED`, `REPORT_NOT_FOUND`,
`IDEMPOTENCY_CONFLICT`, `INTERNAL_ERROR`.

## Market target (shared across every service)

Exactly one of these keys — supplying more than one returns `INVALID_TARGET`:

```ts
{ query: string } | { url: string } | { event_slug: string }
  | { market_slug: string } | { market_id: string } | { condition_id: string }
```

---

## `POST /v1/search` — free

**Request**
```json
{ "query": "Will the Fed cut rates before October?", "limit": 5, "active_only": true }
```

**Response `data`**
```json
{
  "query": "...",
  "matches": [{
    "market_id": "...", "event_slug": "...", "market_slug": "...", "question": "...",
    "match_score": 92, "status": "active", "enable_order_book": true,
    "source_url": "...", "why_matched": "...", "confidence": "match"
  }]
}
```
`confidence` is `"match"` or `"possible_match"` (score < 60). Returns
`AMBIGUOUS_MARKET` (top two candidates within 5 points, distinct markets) or
`MARKET_NOT_FOUND` instead of a `matches` array when appropriate.

---

## `POST /v1/snapshot` — 0.01 USDT

**Request**
```json
{ "target": { "market_slug": "..." }, "outcome": "Yes", "comparison_windows": ["1h", "24h", "7d"] }
```

**Response `data`**
```json
{
  "market_id": "...", "market_slug": "...", "event_slug": "...", "question": "...",
  "outcome": "Yes", "implied_probability_percent": "62.0",
  "pricing_method": "orderbook_midpoint",
  "best_bid": "0.61", "best_ask": "0.63", "spread": "0.02", "spread_bps": "200",
  "changes_pp": { "1h": "0.5", "24h": "-1.2" },
  "warnings": []
}
```
`pricing_method` ∈ `orderbook_midpoint | last_trade | gamma_outcome_price`.
`changes_pp` entries are absent (not zero) when no historical sample was
found. Returns `INSUFFICIENT_MARKET_DATA` when no defensible price exists.

---

## `POST /v1/vitals` — 0.03 USDT

**Request**
```json
{ "target": { "market_slug": "..." }, "outcome": "Yes", "trade_sizes_usd": [100, 500, 1000], "depth_bands": [0.01, 0.03, 0.05] }
```

**Response `data`**
```json
{
  "market_id": "...", "question": "...", "outcome": "Yes",
  "best_bid": "...", "best_ask": "...", "spread": "...", "spread_bps": "...",
  "depth": [{ "band": "0.01", "bid_depth_usd": "...", "ask_depth_usd": "..." }],
  "fills": [{
    "trade_size_usd": "100",
    "buy": { "vwap": "...", "price_impact": "...", "fill_ratio": "1", "partial_fill": false },
    "sell": { "vwap": "...", "price_impact": "...", "fill_ratio": "0.11", "partial_fill": true },
    "exit_difficulty": "hard"
  }],
  "activity": { "recent_trade_count": 72, "recent_volume_usd": "...", "latest_trade_at": "..." },
  "open_interest_usd": "...", "top_holder_share": "...",
  "quality_score": 88.6,
  "quality_components": { "spread_score": 99, "depth_score": 72.2, "activity_score": 86.1, "open_interest_score": 100, "freshness_score": 100, "concentration_score": 72.0 },
  "warnings": []
}
```
`exit_difficulty` ∈ `easy | moderate | hard | unknown`, modeled on the **sell**
leg (closing a position). Requires order-book-enabled markets — otherwise
`MARKET_NOT_ORDERBOOK_ENABLED`.

---

## `POST /v1/resolution-audit` — 0.05 USDT

**Request**
```json
{ "target": { "url": "https://polymarket.com/event/..." }, "include_edge_cases": true }
```

**Response `data`**
```json
{
  "market_id": "...", "question": "...",
  "risk_score": 25, "risk_band": "MEDIUM",
  "findings": [{
    "type": "missing_resolution_source", "severity": "high",
    "evidence": "(none provided)", "explanation": "...", "possible_interpretations": []
  }],
  "missing_information": ["resolution_source"],
  "clean_resolution_requirements": ["Provide an explicit, named resolution source."],
  "dropped_finding_count": 0,
  "llm_unavailable": false,
  "disclaimer": "This is a language audit of the market's stated rules, not a legal judgment or a prediction of Polymarket's final resolution decision."
}
```
`finding.type` ∈ `missing_resolution_source | ambiguous_deadline |
timezone_missing | undefined_term | subjective_verb | conflicting_rule |
non_exhaustive_outcomes | overlapping_outcomes | edge_case_missing |
question_description_mismatch | other`. Every finding's `evidence` is a
verified exact substring of the audited text — findings that fail
verification are dropped, counted in `dropped_finding_count`, never shown.

---

## `POST /v1/contradictions` — 0.08 USDT

**Request**
```json
{ "target": { "event_slug": "..." }, "scan_modes": ["multi_outcome_sum", "logical_implication", "near_duplicate"], "minimum_edge_pp": 3 }
```

**Response `data`**
```json
{
  "event_slug": "...", "event_title": "...",
  "scan_modes_run": ["multi_outcome_sum", "near_duplicate"],
  "candidates": [{
    "type": "near_duplicate",
    "market_ids": ["...", "..."], "questions": ["...", "..."],
    "probabilities_percent": ["100", "47.5"], "discrepancy_pp": "52.5",
    "relationship": "candidate_near_duplicate_claim",
    "why_may_fail": "...", "buffer_pp": "3", "confidence": "medium",
    "manual_checks_required": ["..."]
  }],
  "warnings": []
}
```
`candidate.type` ∈ `multi_outcome_sum | near_duplicate` (a third mode,
`logical_implication`, is accepted in `scan_modes` but currently always
produces zero candidates plus an explicit warning — it needs an LLM relation
classifier not yet built). Language is always "candidate inconsistency" /
"requires manual verification," never "arbitrage."

---

## `POST /v1/full-report` — 0.10 USDT

**Request**
```json
{ "target": { "query": "Will ...?" }, "outcome": "Yes", "trade_sizes_usd": [100, 500], "persist_report": true, "generate_social_card": false, "idempotency_key": "optional-client-supplied-string" }
```

**Response `data`** — composes the four sections above under one report:
```json
{
  "market_id": "...", "question": "...",
  "verdict": "USE_WITH_CONTEXT",
  "signal_confidence": { "score": 89.4, "grade": "HIGH", "disclaimer": "..." },
  "snapshot": { /* Snapshot shape */ },
  "vitals": { /* Vitals shape, or absent if that section failed */ },
  "resolution_audit": { /* Resolution Guard shape, or absent */ },
  "contradictions": { /* Contradiction Scan shape, or absent */ },
  "report_url": "https://probable.example.com/reports/abc123",
  "persisted": true,
  "persistence_status": "persisted",
  "section_failures": [{ "section": "vitals", "reason": "..." }],
  "warnings": []
}
```
`verdict` ∈ `RULES_RISK_DOMINATES | WEAK_MARKET_SIGNAL |
RELATED_MARKETS_DISAGREE | STRONGER_MARKET_SIGNAL | USE_WITH_CONTEXT`
(deterministic band logic, never LLM free-form output — see
`packages/domain/src/reports/verdict.ts`). `persistence_status` ∈
`persisted | not_configured | failed` — `report_url` is only present when
`persisted`. Snapshot is the only section whose failure fails the whole
request; Vitals/Resolution Guard/Contradiction Scan degrade independently
into `section_failures`.

**Idempotency**: reusing `idempotency_key` with the identical request returns
the cached report (no recomputation, no duplicate row). Reusing it with a
*different* request payload returns `409 IDEMPOTENCY_CONFLICT`.

---

## `GET /v1/reports/:publicId` — free

Read-only. Returns a previously persisted, public report's `resultPayload`
in the same envelope shape as whichever service created it (currently only
Full Report persists). `404 REPORT_NOT_FOUND` for an unknown or non-public ID,
or when no persistence backend is configured on this deployment.

---

## `GET /health/live` — free

No external calls. `{ "ok": true, "data": { "status": "live" }, "meta": {} }`.
