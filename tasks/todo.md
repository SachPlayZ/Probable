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

## Phase 7 — Resolution Guard (0.05 USDT)

- [ ] Pick LLM provider (blocking question — see `tasks/decisions.md`)
- [ ] `StructuredModel` adapter, injection-resistant prompt, evidence-span validation
- [ ] Deterministic risk scoring
- [ ] `POST /v1/resolution-audit` route + fixtures for ambiguous/clean markets

## Phase 8 — Full report persistence and UI

- [ ] `packages/db` — Drizzle schema + migrations for `reports`, `upstream_fetches`, `service_usage`, `methodology_versions`
- [ ] Full-report orchestration + deterministic verdict logic
- [ ] `apps/web` — report page, methodology page, social card export
- [ ] `POST /v1/full-report` route + idempotency-key handling

## Phase 9 — Contradiction Scan (0.08 USDT)

- [ ] Multi-outcome-sum rule, logical-implication rule, near-duplicate detection
- [ ] Conservative buffers, relation-confidence scoring
- [ ] `POST /v1/contradictions` route + tests

## Phase 10 — Demo, social card, and submission polish

- [ ] 90-second demo script recording
- [ ] X post with `#OKXAI`
- [ ] Hackathon submission form

## Phase 11 — Optional WebSocket updates (deferred, post-MVP)
