# ADR-002: Database and ORM — Postgres + Drizzle

Status: accepted
Date: 2026-07-17

## Context

Full Report (PLAN.md §12.6) needs to persist reports for shareable
`report_url`s, with idempotency-key support (PLAN.md §13). PLAN.md §8.1
already specifies "PostgreSQL with Drizzle ORM" as the stack choice — this
ADR records the implementation of that pre-made decision plus a few concrete
sub-decisions made while building it, not a fresh evaluation of alternatives.

## Decision

- `packages/db` — Drizzle schema (`pgTable`/`pgEnum`) for `reports`,
  `upstream_fetches`, `service_usage`, `methodology_versions`
  (PLAN.md §17), migrations generated via `drizzle-kit generate`.
- Driver: `drizzle-orm/node-postgres` + `pg` (not `postgres.js`) — the more
  widely deployed option across Railway/Render/Fly.io managed Postgres.
- `ReportsRepository` returns plain domain types (`PersistedReport`), never a
  raw Drizzle row, per AGENTS.md §15.
- Public report IDs: `crypto.randomBytes(9).toString("base64url")` — random,
  non-sequential, never derived from the auto-increment/UUID primary key.
- Idempotency: a nullable-unique `idempotency_key` column on `reports`, plus
  the existing `request_hash` column. Reuse with the same hash returns the
  cached report; reuse with a different hash returns `409
  IDEMPOTENCY_CONFLICT` (new error code, added to the shared taxonomy).

## Alternatives considered

- **SQLite / no persistence for MVP** — rejected; PLAN.md's Definition of
  Done explicitly requires a shareable `report_url`, and the stack section
  already fixed Postgres.
- **`postgres.js` driver** — works equally well with Drizzle; `pg` chosen
  only for wider platform-managed-Postgres familiarity, not a technical
  requirement. Easy to revisit.
- **Deriving `report_url`'s ID from the row's primary key** — rejected per
  AGENTS.md §15's explicit "public IDs must be random and non-sequential"
  rule; also would leak row counts.

## Consequences

- No live production Postgres exists yet. The schema, migration, and full
  CRUD + idempotency path were verified against a real (throwaway, local)
  Postgres instance — spun up with `initdb`/`pg_ctl`, migrated, exercised
  through the actual HTTP persistence flow, then torn down — not just
  typechecked. See `tasks/decisions.md` and `tasks/lessons.md` for what that
  verification caught (a real `report_url` bug on the idempotency cache-hit
  path).
- `packages/config`'s `assertProductionReady` refuses to boot in
  `NODE_ENV=production` without a real `DATABASE_URL` — a missing Postgres in
  production is a boot-time crash, not a silent degrade, by design.
- Every other service's persistence-adjacent tables (`upstream_fetches`,
  `service_usage`, `methodology_versions`) are schema-defined but have no
  repository or write path wired up yet — only `reports` is actually used by
  `full-report.service.ts` today.

## Migration and rollback

Migrations live in `packages/db/drizzle/`, applied via `drizzle-kit migrate`
as an explicit release step (never automatically inside the running
container — see `docs/deployment.md`). Rollback: Full Report already
degrades gracefully to `persisted: false, persistence_status: "not_configured"`
whenever `DATABASE_URL` is absent, so removing the database from a deployment
is non-destructive to every other route.
