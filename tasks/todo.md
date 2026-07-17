# Probable — Build Todo

Tracks AGENTS.md §26 build order. Check items off as completed; keep atomic.

## Phase 0 — Repository and configuration foundation ✅

- [x] Monorepo scaffold (pnpm workspaces, turborepo, tsconfig, root configs)
- [x] `packages/config` — typed env validation, price/x402 registry
- [x] `packages/logger` — structured JSON logs, secret redaction
- [x] `packages/schemas` — MarketTarget, NormalizedMarket, AnalysisMetadata, envelope, error taxonomy
- [x] `packages/polymarket` — Gamma + CLOB clients, schemas, normalization, real fixtures, contract tests
- [x] `packages/domain` — Decimal.js probability/spread/price-selection, match-score, property tests
- [x] `apps/api` skeleton — `/health/live`, request-id, error mapper, body-size guard

## Phase 1 — Gamma search and normalized market model ✅

- [x] Free `POST /v1/search` — real Gamma public-search, match_score ranking, ambiguity handling
- [x] Target resolver — marketId/marketSlug/conditionId/eventSlug/url/query resolution order

## Phase 2 — CLOB snapshot calculations ✅

- [x] Price-selection hierarchy (book midpoint → last trade → Gamma price → insufficient-data)
- [ ] Last-trade fallback (step 2 of hierarchy) — currently skipped, falls straight from book to Gamma price. Needs a CLOB last-trade-price read.
- [x] `changes_pp` via `/prices-history` best-effort (1h/24h; 7d depends on history depth returned)

## Phase 3 — Official x402 integration on Snapshot ✅ (code) / ⚠️ (live verification blocked)

- [x] Typed `PaidRouteConfig` registry, `@okxweb3/x402-express` wiring
- [x] Unpaid → 402 challenge shape verified against real `PaymentRequiredSchema` (via schema-faithful test fake; real OKX facilitator needs production credentials — see `tasks/decisions.md`)
- [ ] Verify a real signed payment reaches the handler exactly once (needs a funded wallet + real OKX credentials — cannot be done in this environment)
- [ ] Replay-protection test against the real facilitator

## Phase 4 — Production deployment and endpoint self-check

- [ ] Provision hosting (Railway/Render/Fly.io) for `apps/api`
- [ ] Provision Postgres + Redis
- [ ] Real `OKX_API_KEY` / `OKX_API_SECRET` / `OKX_API_PASSPHRASE`
- [ ] Real `OKX_X402_PAY_TO` (final receiving wallet — confirm with user)
- [ ] Confirm `OKX_X402_ASSET_ADDRESS` against current official docs immediately before deploy
- [ ] Final public domain (confirm with user)
- [ ] Run production smoke tests (`docs/` script, once written)

## Phase 5 — ASP registration/listing with minimum stable service set

- [ ] Read current `okx-ai` skill identity-register flow before running any `onchainos` command
- [ ] Register Probable ASP identity
- [ ] Register Search + Snapshot as the minimum viable service array
- [ ] Verify every endpoint with `curl -i` before listing

## Phase 6 — Market Vitals (0.03 USDT) ✅

- [x] Order-book simulation (VWAP, price impact, fill ratio) in `packages/domain`
- [x] Market-quality score + components
- [x] Exit-difficulty labels
- [x] `POST /v1/vitals` route + tests
- [x] `packages/polymarket` Data API client (open interest, holders, trades)
- [x] Live-verified against a real thin market: correctly shows partial fill + "hard" exit difficulty on a $1000 sell against ~$116 of visible bid depth

## Phase 7 — Resolution Guard (0.05 USDT) ✅ (code) / ⚠️ (live LLM verification blocked)

- [x] LLM provider: Groq, `openai/gpt-oss-20b`, strict `json_schema` mode (user choice)
- [x] `StructuredModel` adapter (provider-agnostic) + `GroqStructuredModel`, injection-resistant prompt, one retry on invalid output
- [x] Deterministic risk scoring (`packages/domain/src/resolution-risk`) + evidence-span verification
- [x] `POST /v1/resolution-audit` route, deterministic + LLM findings merged, `llm_unavailable` graceful degrade
- [ ] Live-verify against a real Groq completion — needs a real `GROQ_API_KEY` (`LLM_API_KEY` in `.env`), not available in this environment. Code path is fully tested against a fake `StructuredModel` matching the real interface; the `UnavailableStructuredModel` fallback (no key configured) is exercised by every route test that doesn't inject a fake.

## Phase 8 — Full report persistence and UI

- [ ] `packages/db` — Drizzle schema + migrations for `reports`, `upstream_fetches`, `service_usage`, `methodology_versions`
- [ ] Full-report orchestration + deterministic verdict logic
- [ ] `apps/web` — report page, methodology page, social card export
- [ ] `POST /v1/full-report` route + idempotency-key handling

## Phase 9 — Contradiction Scan (0.08 USDT) ✅ (modes A, C) / deferred (mode B)

- [x] Multi-outcome-sum rule (gated on Polymarket's own `negRisk` grouping signal)
- [x] Near-duplicate detection (lexical-similarity proxy, same-deadline gated)
- [ ] Logical-implication rule — needs an LLM relation classifier; request schema
      accepts `logical_implication` in `scan_modes` but the route returns an
      explicit warning and produces no candidates for it (never fabricates a result)
- [x] Conservative buffers (base + half-spread for mode A; `minimum_edge_pp` for mode C), relation-confidence scoring
- [x] `POST /v1/contradictions` route + tests
- [x] Live-verified against a real 13-market negRisk election event: correctly
      excluded 10 unpriced placeholder-candidate markets with an honest warning
      rather than fabricating prices, and correctly did not flag the 3 priced
      real candidates (sum ≈ 1.02, within buffer)

## Phase 10 — Demo, social card, and submission polish

- [ ] 90-second demo script recording
- [ ] X post with `#OKXAI`
- [ ] Hackathon submission form

## Phase 11 — Optional WebSocket updates (deferred, post-MVP)
