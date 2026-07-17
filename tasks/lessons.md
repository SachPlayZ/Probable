# Probable — Lessons

Format: mistake → root cause → permanent prevention rule → check added.

## 2026-07-17

### `turbo prune`'s Docker output drops root-level configs referenced via `extends`

- Mistake: `apps/api/Dockerfile`'s build stage failed with `Cannot read file '/app/tsconfig.base.json'`, cascading into a wall of "target too old" TS errors (`Set`, `.includes()`, regex flags all "not found") that looked like a tsconfig problem in every individual package, when the real cause was one missing file at the root.
- Root cause: `turbo prune <pkg> --docker`'s `out/full` only contains files that live inside the pruned workspace packages themselves. `tsconfig.base.json` lives at the monorepo root and is referenced via `extends: "../../tsconfig.base.json"` from every package — prune has no way to know a root file is a build dependency just from the workspace graph.
- Rule: after adding `turbo prune --docker` to a build, explicitly `COPY` every root-level config file that any pruned package's `tsconfig.json`/build config `extends` or otherwise reaches outside its own directory — don't assume prune's dependency graph covers non-package-scoped files.
- Check added: `apps/api/Dockerfile` now has an explicit `COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json` step with a comment explaining why. Caught by actually building the image with Docker, not by writing the Dockerfile and assuming it would work.

### `(0.15).toFixed(1)` is `"0.1"`, not `"0.2"` — binary floats bite formatting too, not just calculation

- Mistake: `apps/web`'s probability formatter used `Number(percentString).toFixed(1)` and silently rendered a real live market's `"0.15"` probability as `0.1%` in both the page body and the `<title>` tag.
- Root cause: 0.15 has no exact binary floating-point representation (it's stored as `0.1499999999999999944...`), so `toFixed` rounds down instead of the expected half-up. This is the exact same category of float trap AGENTS.md §8 bans for domain *calculations* — it turns out to bite plain *display formatting* just as easily, since `toFixed` is still doing binary-float rounding, not decimal rounding.
- Rule: any place formatting a numeric string for display — not just where a value is computed — needs `Decimal.js`-based rounding (`.toDecimalPlaces(n, Decimal.ROUND_HALF_UP)`) if the underlying value can have a decimal digit at the rounding boundary. Don't treat "formatting" as automatically safe just because it's not "calculation."
- Check added: `apps/web/src/lib/format.ts` routes every numeric formatter through a shared `decimalToFixed` helper. Caught by actually rendering a real persisted report in a real browser-facing HTTP response and reading the output, not by unit-testing the formatter with round-number inputs that wouldn't have exposed the bug.

### A field derived from a DB-generated value can't be baked into the payload written in the same insert

- Mistake: `full-report.service.ts` computed `report_url` (which embeds the DB-generated `public_id`) and stored it *inside* `resultPayload` before calling `INSERT ... RETURNING`. The `public_id` doesn't exist until the insert returns, so the stored `report_url` was always `undefined` — invisible on the first (write) response since that one uses the real post-insert value, but exposed on every subsequent idempotency cache-hit, which was serving the stale stored payload.
- Root cause: conflated "what to persist" with "what a fresh insert's return value will contain" — wrote the response object once and reused it for both the live response and the archival copy, without accounting for the field that only becomes known *after* the write.
- Rule: never bake a DB-generated identifier (serial ID, generated UUID, `public_id`, etc.) into a JSON blob computed *before* the insert that produces it. Either persist without that field and reconstruct it on every read, or do the insert first and build the response from its return value.
- Check added: caught by an actual live-Postgres round-trip test (`full-report-persistence.test.ts`), not by typechecking or a mocked-DB test — the mock would have happily accepted whatever fake ID was configured. When a persistence bug's exact failure mode depends on real DB-generated-value timing, only a real DB catches it.

### `decimal.js` default import breaks under `moduleResolution: NodeNext`

- Mistake: `import Decimal from "decimal.js"` produced `TS2709 Cannot use namespace 'Decimal' as a type` / `TS2351 not constructable` across every domain file.
- Root cause: `decimal.js`'s `.d.ts` merges a class + callable function + namespace under one name with `export default`; under `NodeNext` module resolution the default-import interop for this specific merge pattern doesn't resolve cleanly.
- Rule: always use the named import `import { Decimal } from "decimal.js"` (the package's own doc comment calls this out as the "alternative syntax" — it's actually the robust one under NodeNext).
- Check added: none automated yet; grep for `^import Decimal from "decimal.js"` before adding new domain files.

### `exactOptionalPropertyTypes: true` requires explicit `| undefined` on every optional field that receives a possibly-undefined value

- Mistake: interfaces like `AppErrorShape.details?: Record<string, unknown>` rejected `undefined` being assigned explicitly, across `packages/schemas`, `packages/domain`, `packages/polymarket`.
- Root cause: `exactOptionalPropertyTypes` distinguishes "property absent" from "property present with value `undefined`" — `field?: T` only allows the former at the type level, not `T | undefined` assignment.
- Rule: when a field will be populated from a nullable/optional source (`x?.y`, a Zod `.optional()` output, etc.), declare it as `field?: T | undefined`, not just `field?: T`.
- Check added: `pnpm -w typecheck` catches this immediately; run it after any new interface with optional fields.

### `@types/node` doesn't globally declare `fetch`/`URL`/`AbortController` in this version — needs `"lib": ["ES2022", "DOM"]`

- Mistake: assumed `@types/node` alone was sufficient for `fetch`/`URL`/`AbortController`/`setTimeout` globals in a Node backend; got `Cannot find name 'fetch'` etc. across `packages/polymarket`.
- Root cause: this `@types/node` version doesn't ship its own global declarations for the Fetch API surface; it expects the `DOM` lib for those ambient types (compile-time only — doesn't add browser globals at runtime).
- Rule: Node backends using the global `fetch`/`URL`/`AbortController` need `"lib": ["ES2022", "DOM"]` in tsconfig, not just `@types/node`.
- Check added: `tsconfig.base.json` now sets this at the root so every package inherits it.

### The OKX x402 facilitator requires real API credentials even to build an *unpaid* 402 challenge

- Mistake: assumed (from reading only the README quick-start, which omits credential handling) that generating a 402 `PAYMENT-REQUIRED` challenge was a fully local operation not requiring live facilitator contact.
- Root cause: `@okxweb3/x402-core`'s `x402ResourceServer.initialize()` calls `OKXFacilitatorClient.getSupported()` — an authenticated OKX endpoint — to learn supported scheme/network "kinds" before it can build *any* requirements object, paid or not. Without real `OKX_API_KEY`/`SECRET`/`PASSPHRASE` this 401s, and since the SDK fires this unawaited at middleware construction, an uncaught rejection crashes the whole Node process.
- Rule: never assume payment-SDK behavior from a README's happy path — grep the actual installed package source (`node_modules/.pnpm/.../dist/**/*.js`) for the exact call graph before wiring anything credential-adjacent. Gate `syncFacilitatorOnStart` on whether real credentials are actually configured so local/test environments degrade to a handled error instead of a process crash.
- Check added: `tasks/decisions.md` records this; `apps/api/src/config/payments.ts` has an inline comment; integration tests use a schema-faithful fake instead of depending on live OKX credentials.

### Real Polymarket `/public-search` results can omit `outcomePrices` and `enableOrderBook`

- Mistake: `gammaMarketSchema` required both fields; a real query ("Will Bitcoin reach a new all-time high in 2026?") threw `UPSTREAM_SCHEMA_CHANGED` because two of five returned markets lacked them.
- Root cause: `/public-search` embeds lighter market summaries than `/markets`/`/events`; field presence isn't guaranteed the same way across endpoints.
- Rule: never assume a field observed present in one Gamma endpoint fixture is present in every endpoint that embeds the same nominal "market" shape — capture a fixture per endpoint, not just per schema.
- Check added: `packages/polymarket/src/fixtures/gamma-market-missing-fields.json` (real, sanitized) + regression test `tests/contract.test.ts` "tolerates a real public-search market missing outcomePrices/enableOrderBook".
