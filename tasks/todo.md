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

## Phase 4 — Production deployment and endpoint self-check ✅ (prep) / ⚠️ (blocked on real credentials)

- [x] `apps/api/Dockerfile` — multi-stage, `turbo prune`-based. Actually built and
      run with Docker (Docker Desktop started, image built, container run, real
      outbound Polymarket calls verified from inside it, Docker `HEALTHCHECK`
      confirmed `healthy`) — not just written. Caught and fixed a real bug: `turbo
      prune`'s output doesn't include root-level configs referenced via `extends`
      (`tsconfig.base.json`), which broke the build with cascading "target too old"
      TS errors until copied in explicitly.
- [x] `fly.toml`, `render.yaml`, `railway.json` — one config per platform, all
      pointing at the same Dockerfile, all built from real current platform docs
      (not guessed). Render's blueprint also provisions a managed Postgres.
- [x] `scripts/smoke-test.sh` — run against a real local server; correctly passes
      health/free-route checks and correctly flags the paid route not returning
      402 (expected in this environment — no real OKX credentials — see below)
- [x] `docs/deployment.md` — platform instructions, env var requirements, migration-as-release-step command, what's still blocked
- [ ] Provision hosting for real — needs your platform choice + account
- [ ] Provision a real Postgres (Render's blueprint does this automatically; Fly/Railway need it attached manually) + Redis (referenced in config validation, not yet consumed by any cache layer)
- [ ] Real `OKX_API_KEY` / `OKX_API_SECRET` / `OKX_API_PASSPHRASE`
- [ ] Real `OKX_X402_PAY_TO` (final receiving wallet — confirm with user)
- [ ] Confirm `OKX_X402_ASSET_ADDRESS` against current official docs immediately before deploy
- [ ] Final public domain (confirm with user)
- [ ] Run `scripts/smoke-test.sh` against the real deployed URL once live

## Phase 5 — ASP registration/listing ✅ (prep, everything buildable without credentials) / 🔒 (hard blocker on the registration act itself)

- [x] `docs/okx-listing.md` — exact ASP name/description, full 6-row service
      array with real prices/paths read from `packages/config`, payment
      config checklist, registration sequence. Ready to paste in.
- [x] `docs/demo-script.md` — 90-second script + known-good real markets from
      actual development runs (thin-market exit risk, missing resolution
      source, real duplicate-market discrepancy) + X launch post.
- [x] `docs/api-contracts.md` — every route's real request/response shape,
      generated from the actual Zod schemas, not aspirational.
- [x] `docs/ADR/001-llm-provider-groq.md`, `docs/ADR/002-database-postgres-drizzle.md`
- [ ] **The registration action itself** — confirmed **not possible** in this
      environment: `onchainos` (the CLI the `okx-ai` skill requires for any
      identity/registration action) is not installed here
      (`which onchainos` → not found), and even if it were, it requires the
      user's own OKX wallet login, which cannot be performed on their behalf.
      This is a hard external blocker, not a scoping choice — verified by
      checking, not assumed.
- [ ] Deploy first (Phase 4), then run the sequence in `docs/okx-listing.md`

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

## Phase 8 — Full report persistence and UI ✅ (backend + persistence) / ⚠️ (UI)

- [x] Full-report orchestration composing Snapshot + Vitals + Resolution Guard + Contradiction Scan
- [x] Deterministic verdict logic (`packages/domain/src/reports`) + signal-confidence model (PLAN §14)
- [x] `packages/db` — Drizzle schema + generated migration for `reports`, `upstream_fetches`, `service_usage`, `methodology_versions`. Migration generation AND application were verified against a real throwaway local Postgres (initdb + pg_ctl, torn down after) — not just typechecked.
- [x] `POST /v1/full-report` route — real persistence via `ReportsRepository` when `DATABASE_URL` is configured; honest `persisted: false, persistence_status: "not_configured"` when it isn't (never fakes success). A DB failure at write time degrades to an unpersisted response rather than 500ing (AGENTS §15).
- [x] Real `idempotency_key` enforcement: same key + same payload → cached report (verified real HTTP round-trip returns the identical `report_url`); same key + different payload → `409 IDEMPOTENCY_CONFLICT` (new error code, added to the taxonomy). Caught and fixed a real bug during this verification: the cached-response path was returning `report_url: undefined` because the URL depends on the DB-generated `public_id`, which doesn't exist yet when the row is first written — fixed by deriving it fresh from the found row on every cache hit.
- [x] `apps/web` — minimal Next.js App Router frontend: `/` (service catalog), `/methodology`, `/reports/[id]`. Scoped down from PLAN.md §7's full 7-page site (`/app`, `/status`, `/privacy`, `/terms` not built) since none of those block ASP registration or agent usage — see `tasks/decisions.md`.
- [x] Free `GET /v1/reports/:publicId` added to apps/api so `report_url` actually resolves to something.
- [ ] Social card export (1200×630) — not built.
- [x] Live-verified end to end: real Postgres → real `buildFullReport()` call against live Polymarket data → real HTTP fetch from the Next.js server component → rendered page, including a real caught bug (probability formatting, see `tasks/lessons.md`) and confirmation that the same real duplicate-market discrepancy found earlier renders correctly in the "Related-market inconsistencies" section. Production `next build` and `eslint` both pass (caught and fixed one real lint error: internal links must use `next/link`, not bare `<a>`).

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
