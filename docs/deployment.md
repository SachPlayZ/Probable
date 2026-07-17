# Deployment — apps/api

This covers deploying the API service only. `apps/web` doesn't exist yet.

## What's already verified

- `apps/api/Dockerfile` builds cleanly and runs correctly — actually built and run
  with Docker (not just written): the pruned-monorepo build produces a working
  image, the container answers `/health/live` with `200`, Docker's own
  `HEALTHCHECK` reports `healthy`, and outbound calls to the real Polymarket API
  work from inside the container.
- The Drizzle migration in `packages/db/drizzle/0000_furry_stardust.sql` was
  applied to a real (throwaway, local) Postgres and exercised through the full
  repository + HTTP persistence/idempotency path. See `tasks/decisions.md`.
- `scripts/smoke-test.sh` was run against a live local server and correctly
  distinguishes real failures from environment-specific expected states (see
  below).

## What's still blocked on you

Before any of this goes to a real domain, you need to supply, per
`tasks/decisions.md`'s open questions:

1. **Real OKX facilitator credentials** — `OKX_API_KEY` / `OKX_API_SECRET` /
   `OKX_API_PASSPHRASE`. Without these, paid routes return a handled `500`
   instead of a real `402` challenge — this is not a bug, it's
   `packages/config`'s `hasCredentials` gate working as designed (see
   `apps/api/src/config/payments.ts`). `scripts/smoke-test.sh` will flag this
   exact condition; that's expected until real credentials are set.
2. **Final receiving wallet** — `OKX_X402_PAY_TO`. `packages/config` refuses to
   boot in `NODE_ENV=production` with the placeholder address.
3. **Verified settlement asset address** — `OKX_X402_ASSET_ADDRESS`. Re-check
   against current official OKX docs immediately before deploying (AGENTS.md
   §16.1 — never trust a stale value here).
4. **A real Postgres** — `DATABASE_URL`. Every platform config below either
   provisions one (Render) or expects you to attach one (Fly, Railway).
5. **A real Groq API key** — `LLM_API_KEY` (`LLM_PROVIDER=groq`). Without it,
   Resolution Guard runs deterministic-only and reports `llm_unavailable: true`
   — a documented, graceful degradation, not a crash.
6. **Final public domain** for `PUBLIC_API_URL` / `PUBLIC_WEB_URL`.

## Environment variables

Full list and defaults: `.env.example`. Production-required (checked at boot by
`packages/config`'s `assertProductionReady`): `DATABASE_URL`, `REDIS_URL`,
`OKX_X402_PAY_TO`, `OKX_X402_ASSET_ADDRESS`, `OKX_API_KEY`, `OKX_API_SECRET`,
`OKX_API_PASSPHRASE` — the process crashes on boot rather than serving with
placeholder payment config. `REDIS_URL` is checked but not yet consumed
anywhere (no cache layer built yet — everything is `cache_status: "miss"`
today); set it to any reachable Redis for now, or treat that boot check as the
next thing to either wire up or relax.

## Picking a platform

All three work off the same `apps/api/Dockerfile`, built from the **monorepo
root** (not `apps/api/`) since it needs the full workspace to run
`turbo prune`.

### Fly.io (`fly.toml`, repo root)

```bash
flyctl launch --no-deploy   # first time only; decline the offer to create a Postgres
                             # unless you want Fly's managed one — flyctl postgres create
flyctl secrets set DATABASE_URL=... REDIS_URL=... OKX_API_KEY=... OKX_API_SECRET=... \
  OKX_API_PASSPHRASE=... OKX_X402_PAY_TO=0x... OKX_X402_ASSET_ADDRESS=0x... LLM_API_KEY=...
flyctl deploy
```

`min_machines_running = 1` is set deliberately — a paid ASP endpoint that
cold-starts on the first request would blow the P95 latency targets in
PLAN.md §5. Reconsider this if traffic is low and cost matters more than tail
latency.

### Render (`render.yaml`, repo root — Blueprint)

Connect the repo in the Render dashboard, it detects `render.yaml`
automatically. Provisions a managed Postgres (`probable-db`) and wires
`DATABASE_URL` automatically. Everything marked `sync: false` gets prompted
for during Blueprint setup — never committed.

### Railway (`railway.json`, repo root)

Railway auto-detects the Dockerfile path from `railway.json`. Attach a
Postgres plugin from the Railway dashboard and it injects `DATABASE_URL`
automatically; set the remaining secrets in the service's Variables tab.

## Release step: run the migration

Per PLAN.md §22, migrations run as an explicit release step, never
automatically inside the running container. After provisioning `DATABASE_URL`
on whichever platform:

```bash
cd packages/db
DATABASE_URL=<production-url> npx drizzle-kit migrate
```

Do this once per schema change, before traffic hits the new code — not on
every container start/scale-out.

## After deploying

```bash
./scripts/smoke-test.sh https://<your-api-domain>
```

Expected on a fully-configured production deploy: `/health/live` → 200,
`/v1/search` → no payment challenge, `/v1/snapshot` → 402 with a decodable
`PAYMENT-REQUIRED` header whose `network`/`payTo` match your real config. If
the last one still 500s, real OKX credentials aren't reaching the container —
check the platform's secret/env configuration before assuming it's a code bug.

## apps/web (Vercel)

Deployed independently of the API, per PLAN.md §8.1. From the Vercel dashboard,
import the repo and set:

- **Root Directory**: `apps/web`
- **Framework Preset**: Next.js (auto-detected)
- **Environment variable**: `API_URL` → your deployed `apps/api` URL (server-side
  only; the report page fetches from it in a server component, never exposed to
  the browser)

Vercel builds `apps/web` as a pnpm workspace member automatically — no extra
config needed beyond the root directory setting. Verified locally: `next build`
produces `/` and `/methodology` as static pages and `/reports/[id]` as
server-rendered-on-demand (it needs a live fetch per request), which is exactly
the right shape for Vercel's default Next.js runtime.

`packages/schemas`' `PLAN.md §16.1 PaidRouteConfig.payTo` values never reach the
frontend — `apps/web` only ever calls the free `GET /v1/reports/:publicId`
endpoint, never a paid route, so it needs no payment/wallet integration at all.

## Not yet covered here

- Social card export (1200×630) for report sharing — not built.
- `/app` (interactive query UI), `/status`, `/privacy`, `/terms` pages — scoped
  out for now; see `tasks/decisions.md`. None of them block ASP registration or
  agent-to-agent usage.
- ASP registration on OKX.AI — separate step, needs the final deployed URLs
  first (AGENTS.md §16.5).
- Redis — referenced in config validation but no cache layer is implemented
  yet; every response is currently `cache_status: "miss"`.
