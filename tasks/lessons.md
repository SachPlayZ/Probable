# Probable — Lessons

Format: mistake → root cause → permanent prevention rule → check added.

## 2026-07-17

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
