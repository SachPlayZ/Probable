# Probable — Recorded Assumptions and Decisions

Per AGENTS.md §5 ambiguity policy: safest smallest reversible choice, recorded here, user asked only when it changes money flow / public API / security.

## 2026-07-17 — Phase 0 slice

### Semantic similarity uses lexical token overlap, not an LLM

PLAN.md §12.1's `match_score` allows semantic_similarity to come from either an LLM reranker or a deterministic method. Phase-0 uses Jaccard token overlap for both `semantic_similarity` and `title_token_overlap` components, computed with `Decimal.js` (never a JS float score). Documented as a `limitations` entry on every `/v1/search` response. Upgrading to an LLM reranker is optional per AGENTS.md §11 ("do not call the LLM when deterministic rules are sufficient") and deferred to Phase 7 (Resolution Guard) when a provider is chosen anyway.

### Last-trade fallback (price-selection hierarchy step 2) not yet implemented

`packages/domain/src/probability/price-selection.ts` supports the input shape (`lastTradePrice`, `lastTradeAgeMs`) and is tested, but `apps/api/src/services/snapshot.service.ts` does not yet call a CLOB last-trade-price endpoint — it goes straight from order-book midpoint to the Gamma outcome-price fallback. Every response that hits this path carries an explicit warning. Tracked in `tasks/todo.md` Phase 2.

### `syncFacilitatorOnStart` gated on `config.okx.hasCredentials`

Discovered by reading `@okxweb3/x402-core`'s source directly (AGENTS.md §2 "do not guess payment fields"): `OKXFacilitatorClient.getSupported()` — the call used to build even an *unpaid* 402 challenge — is an authenticated OKX endpoint that 401s without real `OKX_API_KEY`/`OKX_API_SECRET`/`OKX_API_PASSPHRASE`. The x402-express middleware fires this eagerly and unawaited at construction time; letting it reject crashes the process via an unhandled rejection.

Decision: `apps/api/src/config/payments.ts` passes `syncFacilitatorOnStart: config.okx.hasCredentials`. With real credentials (production), the real 402/200 payment flow works as documented. Without them (local dev without secrets), paid routes return a handled `500` instead of crashing — a known, intentional local-dev limitation, not a production behavior. Recorded so a future agent doesn't "fix" this by hardcoding `true`.

### Integration tests use a schema-faithful fake x402 middleware

`apps/api/tests/support/fake-payment-middleware.ts` reproduces `@okxweb3/x402-core`'s real `PaymentRequiredSchema` wire shape (verified by reading `dist/esm/schemas/index.d.mts` directly) so the test suite can assert 402 challenge decoding, resource-URL matching, and handler-not-invoked behavior without live OKX credentials. `createApp`'s `paymentMiddleware` dependency-injection point exists solely for this; production (`server.ts`) always uses the real `createPaymentMiddleware` from the official SDK. This is not "custom payment verification" (AGENTS.md §3/§12 forbids that in production code) — it never runs outside `tests/`.

### Gamma `/public-search` market summaries: `outcomePrices` and `enableOrderBook` are optional

Live-verified: some markets embedded in `/public-search` responses omit these fields entirely (confirmed via a captured, sanitized fixture — `packages/polymarket/src/fixtures/gamma-market-missing-fields.json`). Schema updated to make both optional; normalization reads absence as "unknown" — `enableOrderBook` defaults to `false` (the non-tradable assumption), `gammaPrice` stays `undefined` (never coerced to `0`). Regression test added per AGENTS.md §9 schema-change protocol.

### Placeholder payment/deployment values

`OKX_X402_PAY_TO`, `OKX_X402_ASSET_ADDRESS`, and the public domain are still placeholders (`.env.example`). `packages/config`'s `assertProductionReady` refuses to boot in `NODE_ENV=production` with placeholder addresses or missing OKX credentials/DB/Redis URLs — this is a hard gate, not just documentation. Real values are genuine blockers for Phase 4 (deployment) and Phase 5 (ASP registration), not for the code itself.

## 2026-07-17 — Phase 6/7 slice (Vitals, Resolution Guard)

### LLM provider: Groq, `openai/gpt-oss-20b`, strict JSON schema mode

User chose Groq's free API. Confirmed via `console.groq.com/docs/structured-outputs` (not guessed): `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }` with `strict: true` support limited to `openai/gpt-oss-20b` / `openai/gpt-oss-120b` — used the 20b model. `zod-to-json-schema` (`target: "openAi"`) converts the Zod finding schema to the exact shape Groq's strict mode expects. `packages/config`'s existing generic `LLM_PROVIDER`/`LLM_API_KEY` fields cover this (added `LLM_MODEL`, default `openai/gpt-oss-20b`) — no Groq-specific config leaked outside `apps/api/src/llm/`.

No real `GROQ_API_KEY` is available in this environment, so the Groq integration is verified only against a fake `StructuredModel` that implements the same interface (`apps/api/tests/support/fake-structured-model.ts`) — same pattern as the x402 fake payment middleware. When no `LLM_API_KEY` is configured, `apps/api/src/app.ts` wires an `UnavailableStructuredModel` that fails fast with `LlmUnavailableError`, which the route maps to `llm_unavailable: true` + a `limitations` entry rather than a 500 — this is the actual behavior exercised by every current test run (real key not present) and matches AGENTS.md §23's "LLM unavailable" failure-state rule exactly. Live-verifying a real Groq completion is a blocker until a real key is supplied.

### Top-holder concentration is a proxy, not true total-supply share

Polymarket's public `/holders` endpoint returns only the top N holders per token, with no total-outstanding-shares figure. `top_holder_share` in Vitals is computed as `top_holder.amount / sum(returned_top_holders.amount)` — concentration among *visible* top holders, not literal share of total supply. Every response carries an explicit warning saying so. A future version could compute a true total-supply share if Polymarket exposes one; tracked as a methodology-v2 candidate, not a blocker.

### Exit difficulty is modeled on the sell leg, not the buy leg

"Exit difficulty" describes closing an existing position, i.e. selling. `vitals.service.ts` computes `exit_difficulty` from the sell-side order-book simulation (consuming bids) even though both buy and sell fills are returned. Documented inline since PLAN.md §12.3 doesn't disambiguate this explicitly.

## 2026-07-17 — Phase 8 slice (persistence)

### Postgres/Drizzle verified against a real throwaway local instance, not just typechecked

This environment has no provisioned Postgres, but `postgresql@14` is installed via Homebrew. Rather than leaving the DB layer typecheck-only, spun up a throwaway instance (`initdb` + `pg_ctl` on a non-default port, isolated data dir under the scratchpad), ran the real `drizzle-kit generate` → `drizzle-kit migrate` → repository CRUD → app-level persistence + idempotency flow against it end to end, then tore it down completely (`pg_ctl stop` + `rm -rf` the data dir). Nothing was left running or on disk afterward. This caught a real bug (see below) that pure typechecking would have missed.

### idempotency_key column and 409 IDEMPOTENCY_CONFLICT added

`reports.idempotency_key` is a nullable unique text column. `IDEMPOTENCY_CONFLICT` (409) was added to the shared error taxonomy in `packages/schemas/src/errors.ts` — the taxonomy is not literally frozen; PLAN.md §11's list is what's needed so far, and this is a spec-mandated (§13) code that was simply missing.

### report_url must be derived fresh from the stored row on a cache hit, not from the stored payload

Real bug caught during live-Postgres verification: `report_url` depends on the DB-generated `public_id`, which doesn't exist yet at the moment the row is first written (`resultPayload` was serialized before `INSERT ... RETURNING` ran). The idempotency cache-hit path was returning the stale `report_url: undefined` baked into that early snapshot. Fixed in `apps/api/src/services/full-report.service.ts` by reconstructing `report_url` from `existing.publicId` on every cache hit instead of trusting the stored payload's own field. Logged in `tasks/lessons.md`.

## 2026-07-17 — Phase 8 slice (frontend)

### apps/web scoped to 3 pages, not PLAN.md §7's full 7-page site

Built `/`, `/methodology`, `/reports/[id]` only — not `/app`, `/status`, `/privacy`, `/terms`.
Reasoning discussed with the user directly: none of the missing pages block ASP
registration (which only needs the API endpoints) or agent-to-agent usage (agents
consume JSON directly, never the frontend). The three built pages cover every
"Definition of Done" product checkbox in PLAN.md §29 that actually depends on a
frontend: report page, methodology page, disclaimer. `/app` (query input UI) would
only matter for a human using the product interactively rather than via an agent or
a direct API call — deferred, not abandoned, if that use case becomes a priority.

### GET /v1/reports/:publicId added — wasn't in the original 6-service catalog

Full Report's `report_url` field pointed at a route that didn't exist. Added a
free, read-only `GET /v1/reports/:publicId` (new `REPORT_NOT_FOUND` error code)
specifically so that field resolves to something once a report is persisted and
`apps/web` is deployed. This is infrastructure the 6 paid/free services need, not
a 7th billable service.

## Open blocking questions (AGENTS.md §28)

- Final receiving wallet address (`OKX_X402_PAY_TO`)?
- Final public domain?
- Real `GROQ_API_KEY` for live Resolution Guard verification?
- Hosting target for `apps/api` (Railway/Render/Fly.io) and Postgres/Redis provider?
