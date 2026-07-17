# ADR-001: LLM provider for Resolution Guard — Groq via LangChain

Status: accepted (superseded 2026-07-17 — see revision note below)
Date: 2026-07-17

## Context

Resolution Guard (PLAN.md §12.4) needs an LLM to extract structured
resolution-language findings with exact evidence spans. AGENTS.md §18
requires the domain/route code depend only on a provider-agnostic
`StructuredModel` interface, never a specific vendor SDK directly. A provider
still had to be picked to implement that interface against something real.

## Decision

Use Groq's API, model `openai/gpt-oss-20b`, via `@langchain/groq`'s
`ChatGroq.withStructuredOutput(zodSchema, { method: "jsonSchema", strict: true })`,
which drives Groq's strict `json_schema` response format directly from the
same Zod schema used to validate the result. User's explicit choices: Groq
(free tier) as the provider, LangChain as the integration layer.

Implementation: `apps/api/src/llm/structured-model.ts` defines the
provider-agnostic interface; `apps/api/src/llm/groq-provider.ts` is the only
file that imports `@langchain/groq` or `@langchain/core`. Nothing outside
that one file knows a specific provider or framework exists.

## Revision note (same day)

The first version of this ADR used `groq-sdk` directly plus
`zod-to-json-schema` for manual schema conversion, and explicitly rejected
LangChain as an unnecessary dependency for a single structured-extraction
call. On reflection, and per explicit user direction to use LangChain where
it applies: `withStructuredOutput` is exactly the batteries-included version
of what was hand-built (JSON-schema conversion from Zod, low temperature,
one-retry-shaped validation loop) — genuinely less code to maintain, not
more, once the dependency is already justified by the user's ask. The one
call this project makes to an LLM is still a single structured-extraction
request, not a multi-step agentic workflow — so LangGraph (the orchestration
layer) remains unused, and only `@langchain/groq` + `@langchain/core`'s
`withStructuredOutput` are in the dependency tree, not the broader
`langchain` chains/agents package.

## Alternatives considered

- **OpenAI / Anthropic** — same interface would apply either way; not chosen
  because the user specifically asked for Groq.
- **Raw `groq-sdk` + hand-rolled `zod-to-json-schema` conversion** — the
  original implementation; replaced per the revision above. Kept as a
  documented alternative since it's a legitimate, smaller-dependency option
  if `@langchain/*` is ever removed from this project for other reasons.
- **LangGraph** — not used. Nothing in this project needs stateful
  multi-step/cyclical agent orchestration; Resolution Guard is one call in,
  one validated JSON object out.

## Consequences

- `LLM_API_KEY` / `LLM_PROVIDER=groq` / `LLM_MODEL` are the only
  Groq-specific config; swapping providers later means writing one new file
  implementing `StructuredModel` (potentially reusing a different
  `@langchain/*` chat-model package) and changing config, not touching any
  route or service code.
- Groq's strict `json_schema` mode (`strict: true`) is only supported on
  `openai/gpt-oss-20b` / `openai/gpt-oss-120b` at the time this was written —
  re-check Groq's docs before changing the model, since other models fall
  back to best-effort JSON mode without schema enforcement. This applies the
  same whether called directly or through LangChain.
- `StructuredModel.generate<T>`'s generic is now constrained to
  `T extends Record<string, unknown>` to match `withStructuredOutput`'s own
  constraint — every schema in this codebase is already a Zod object type, so
  this cost nothing in practice.
- No real `GROQ_API_KEY` was available during development; the integration
  was verified against a fake `StructuredModel` implementing the exact same
  interface (`apps/api/tests/support/fake-structured-model.ts`), and the
  `UnavailableStructuredModel` fallback (used when no key is configured) is
  what every current test run actually exercises end-to-end. Live Groq
  verification remains an open item — see `tasks/decisions.md`.

## Migration and rollback

Rollback: unset `LLM_API_KEY` — `apps/api/src/app.ts` falls back to
`UnavailableStructuredModel`, and Resolution Guard degrades to
deterministic-only findings with `llm_unavailable: true` rather than
breaking. No data migration involved. Swapping back to raw `groq-sdk` would
mean restoring the pre-revision `groq-provider.ts` and re-adding
`groq-sdk`/`zod-to-json-schema` to `apps/api/package.json` — both packages
were removed from dependencies when this revision landed.
