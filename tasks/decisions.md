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

## Open blocking questions (AGENTS.md §28)

- Final receiving wallet address (`OKX_X402_PAY_TO`)?
- Final public domain?
- Real `GROQ_API_KEY` for live Resolution Guard verification?
- Hosting target for `apps/api` (Railway/Render/Fly.io) and Postgres/Redis provider?
