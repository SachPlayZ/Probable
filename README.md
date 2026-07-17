<p align="center">
  <img src="apps/web/public/probable.png" alt="Probable" width="120" />
</p>

<h1 align="center">Probable</h1>

<p align="center">
  <strong>What does the market actually believe?</strong>
</p>

<p align="center">
  A live, financially-backed prediction-market intelligence service for AI agents — built on
  public Polymarket data, priced per call, and paid for over <a href="https://x402.org">x402</a>.
</p>

---

Probable turns Polymarket's public order books into deterministic, auditable answers to
future-looking questions. Instead of an LLM guessing an outcome from training data, an agent
calls Probable and gets a real, current, market-implied probability — with the inputs and
methodology version attached, so the number can be checked, not just trusted.

It ships as an [OKX.AI](https://web3.okx.com/onchainos) A2MCP Agent Service Provider ("ASP"): six
independently priced endpoints under one identity, each gated by an [x402](https://x402.org)
payment challenge and settled on X Layer.

> [!NOTE]
> Probable is **read-only**. It never places, cancels, or signs a Polymarket order, and never
> custodies funds beyond receiving its own service fees. See [`AGENTS.md`](./AGENTS.md) for the
> full set of non-negotiable product rules.

## Services

| Endpoint | Price | What it returns |
|---|---|---|
| `POST /v1/search` | Free | Resolves a question, URL, or slug to a concrete Polymarket market |
| `POST /v1/snapshot` | $0.01 | Current implied probability, bid/ask spread, and short-window movement |
| `POST /v1/vitals` | $0.03 | Order-book depth, fill cost, price impact, and exit difficulty |
| `POST /v1/resolution-audit` | $0.05 | Audits a market's resolution wording for ambiguity and edge-case risk |
| `POST /v1/contradictions` | $0.08 | Flags candidate inconsistencies across related markets |
| `POST /v1/full-report` | $0.10 | All of the above, composed into one report with a shareable link |

Every response carries a `methodology_version`, the calculation inputs, and explicit
`limitations` — full request/response shapes are in [`docs/api-contracts.md`](./docs/api-contracts.md).

> [!IMPORTANT]
> Probabilities and scores are computed with `Decimal.js` from live order-book data — never by an
> LLM. Language models are only used for the resolution-wording audit, and even there they
> classify, they don't calculate.

## Architecture

```
probable/
├── apps/
│   ├── api/       Express API — the six services above, x402 payment gate, Polymarket clients
│   └── web/       Next.js report viewer (/, /methodology, /reports/[id])
├── packages/
│   ├── domain/    Pure calculation logic (probability, spread, VWAP, quality score, verdict)
│   ├── polymarket/  Gamma / CLOB / Data API clients
│   ├── schemas/   Zod request & response contracts, shared by api + web
│   ├── db/        Drizzle schema + repository for persisted reports
│   ├── config/    Env validation, route pricing, production readiness checks
│   └── logger/    Structured logging
└── docs/          API contracts, deployment guide, ADRs, OKX.AI listing payload
```

A request to any paid route flows: **x402 payment verification → Zod request validation →
Polymarket data fetch → deterministic calculation in `packages/domain` → response**. Payment is
checked before any upstream call is made, and a paid route never partially executes on invalid
input.

## Getting started

**Prerequisites:** Node.js ≥ 20, [pnpm](https://pnpm.io) 10.12.1 (`corepack enable` picks up the
pinned version automatically).

```bash
pnpm install
cp .env.example .env   # fill in Polymarket/OKX/LLM values — see below
pnpm dev:api           # apps/api on :4000
```

`apps/web` runs independently:

```bash
pnpm --filter @probable/web dev
```

### Environment

All variables and their defaults are in [`.env.example`](./.env.example). At minimum, expect to
set:

- `OKX_API_KEY` / `OKX_API_SECRET` / `OKX_API_PASSPHRASE` — required to issue real `402`
  challenges; without them paid routes return a handled `500` instead (by design).
- `OKX_X402_PAY_TO` / `OKX_X402_ASSET_ADDRESS` — the receiving wallet and settlement token.
- `DATABASE_URL` — only needed to persist and serve `full-report` results back via
  `GET /v1/reports/:publicId`.
- `LLM_API_KEY` (Groq) — optional; Resolution Guard degrades to deterministic-only checks and
  reports `llm_unavailable: true` without it.

### Tests

```bash
pnpm test              # unit tests, all packages
pnpm test:integration   # apps/api integration tests
./scripts/smoke-test.sh <base-url>   # live endpoint check post-deploy
```

## Deployment

`apps/api` ships as a single [multi-stage Dockerfile](./apps/api/Dockerfile), built from the
monorepo root so Turborepo can prune it down to just the packages the API depends on. Fly.io,
Render, and Railway configs are included at the repo root and work off that same image; `apps/web`
deploys independently to Vercel. Full instructions, required environment variables, and the
release-migration step are in [`docs/deployment.md`](./docs/deployment.md).

## Documentation

| Doc | Covers |
|---|---|
| [`docs/api-contracts.md`](./docs/api-contracts.md) | Full request/response schemas for every route |
| [`docs/deployment.md`](./docs/deployment.md) | Platform configs, required env vars, release steps |
| [`docs/okx-listing.md`](./docs/okx-listing.md) | The exact ASP registration payload for OKX.AI |
| [`docs/demo-script.md`](./docs/demo-script.md) | A walkthrough script for demoing the service end-to-end |
| [`docs/ADR/`](./docs/ADR) | Architecture decision records |
| [`AGENTS.md`](./AGENTS.md) | The operating contract this codebase is built and reviewed against |

## Tech stack

TypeScript · Turborepo · pnpm workspaces · Express · Next.js · Zod · Decimal.js · Drizzle ORM ·
Groq (via LangChain) · [OKX x402 SDK](https://web3.okx.com/onchainos) for payment verification and
settlement on X Layer.
