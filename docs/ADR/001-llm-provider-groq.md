# ADR-001: LLM provider for Resolution Guard — Groq

Status: accepted
Date: 2026-07-17

## Context

Resolution Guard (PLAN.md §12.4) needs an LLM to extract structured
resolution-language findings with exact evidence spans. AGENTS.md §18
requires the domain/route code depend only on a provider-agnostic
`StructuredModel` interface, never a specific vendor SDK directly. A provider
still had to be picked to implement that interface against something real.

## Decision

Use Groq's API (`groq-sdk`), model `openai/gpt-oss-20b`, via strict
`json_schema` response-format mode. User's explicit choice (Groq free tier).

Implementation: `apps/api/src/llm/structured-model.ts` defines the interface;
`apps/api/src/llm/groq-provider.ts` is the only file that imports `groq-sdk`.
Nothing outside that one file knows a specific provider exists.

## Alternatives considered

- **OpenAI** — also viable, same interface would apply; not chosen because
  the user specifically asked for Groq's free API.
- **Anthropic** — same interface applies; not chosen for the same reason.
- **LangChain's provider abstraction** — considered and rejected. LangChain
  is a general agent-orchestration toolkit; using it here just to get a
  structured-output call would add a large dependency for a feature our own
  ~20-line `StructuredModel` interface already covers exactly as specified in
  AGENTS.md §18. AGENTS.md §24 explicitly prohibits adding a library the
  platform (or in this case, a trivial interface) already provides for.

## Consequences

- `LLM_API_KEY` / `LLM_PROVIDER=groq` / `LLM_MODEL` are the only
  Groq-specific config; swapping providers later means writing one new file
  implementing `StructuredModel` and changing config, not touching any route
  or service code.
- Groq's strict `json_schema` mode (`strict: true`) is only supported on
  `openai/gpt-oss-20b` / `openai/gpt-oss-120b` at the time this was written —
  re-check Groq's docs before changing the model, since other models fall
  back to best-effort JSON mode without schema enforcement.
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
breaking. No data migration involved.
