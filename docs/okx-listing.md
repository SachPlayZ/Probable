# OKX.AI ASP Listing — Registration-Ready

This is the exact payload to use when registering Probable as an ASP, so that
step is a copy-paste once deployment + wallet login are available. Nothing
here can be executed without: (1) real deployed HTTPS URLs for every route
below, and (2) an authenticated `onchainos` wallet session — neither exists in
the build environment this document was prepared in. Follow
[`references/identity-register.md`](../.agents/skills/okx-ai/references/identity-register.md)
in the `okx-ai` skill for the actual registration flow; this file supplies the
content, not the procedure.

## Pre-registration checklist

- [ ] `apps/api` deployed to its final domain (see `docs/deployment.md`)
- [ ] Every route below verified with `curl -i` against the live URL
- [ ] `OKX_X402_PAY_TO` is the real receiving wallet, not the placeholder
- [ ] `OKX_X402_ASSET_ADDRESS` re-verified against current official OKX docs
      immediately before registering (AGENTS.md §16.1 — never trust a stale
      value here, even this one)
- [ ] `onchainos` CLI installed and wallet logged in (confirmed **not**
      present in the environment this doc was written in — install and log in
      separately, per `okx-agentic-wallet`'s preflight)

## ASP identity

- **Name:** Probable
- **Description:** Live prediction-market intelligence for AI agents. Search real-world questions, retrieve market-implied probabilities, evaluate liquidity and resolution quality, and detect related-market inconsistencies using public Polymarket data.

## Service array

Replace `https://api.probable.<domain>` with the real deployed base URL before
submitting. Prices and route paths below are read directly from
`packages/config`'s `loadConfig()` — do not hand-retype them elsewhere; if
they ever drift, this doc is wrong and `packages/config` is the source of
truth.

| # | Name | Method | Path | Price | Free? |
|---|------|--------|------|-------|-------|
| 1 | Market Search | `POST` | `/v1/search` | — | Yes |
| 2 | Probability Snapshot | `POST` | `/v1/snapshot` | $0.01 | No |
| 3 | Market Vitals | `POST` | `/v1/vitals` | $0.03 | No |
| 4 | Resolution Guard | `POST` | `/v1/resolution-audit` | $0.05 | No |
| 5 | Contradiction Scan | `POST` | `/v1/contradictions` | $0.08 | No |
| 6 | Full Intelligence Report | `POST` | `/v1/full-report` | $0.10 | No |

Supporting free route (not billable, not part of the service array, but
should be verified alongside the others): `GET /v1/reports/:publicId` and
`GET /health/live`.

### Per-service descriptions (from PLAN.md §16.4 — do not rewrite ad hoc)

**Market Search — Free**
Find active Polymarket markets matching a natural-language question or Polymarket URL. Returns ranked candidates, IDs, status, and match confidence.

**Probability Snapshot — 0.01 USDT**
Get a timestamped implied probability with bid, ask, spread, price method, recent movement, market-quality score, and limitations.

**Market Vitals — 0.03 USDT**
Analyze order-book depth, estimated fill cost, price impact, open interest, activity, concentration, and exit difficulty.

**Resolution Guard — 0.05 USDT**
Audit a market's question and resolution rules for ambiguous deadlines, undefined terms, conflicting conditions, and missing edge cases.

**Contradiction Scan — 0.08 USDT**
Find candidate probability inconsistencies across related markets while accounting for definitions, deadlines, spread, liquidity, and uncertainty.

**Full Intelligence Report — 0.10 USDT**
Generate a complete, timestamped market report combining probability, market health, resolution risk, related-market analysis, and a shareable visual page.

## Payment configuration (verify current, do not assume)

From `.env.example` / `packages/config`, confirmed against official
OKX x402 docs at implementation time (2026-07-17) — **re-verify all three
immediately before registering**, per AGENTS.md §16.1:

```text
OKX_X402_NETWORK=eip155:196
OKX_X402_ASSET_ADDRESS=<verify current official settlement asset before deploy>
OKX_X402_PAY_TO=<real receiving wallet — placeholder in this repo>
```

## Registration sequence (PLAN.md §16.5)

1. Deploy all routes to final HTTPS URLs (`docs/deployment.md`).
2. Run `scripts/smoke-test.sh <live-url>` — confirm free route 200s with no
   challenge, paid route 402s with a decodable, correctly-addressed challenge.
3. Install/update the `okx-ai` and `okx-agentic-wallet` skills' CLI
   (`onchainos`) if not already current.
4. Log in to the Agentic Wallet.
5. Register **one** A2MCP ASP identity named Probable.
6. Add the full 6-row service array above before selecting Done — do not
   register a partial array and add services later; the `okx-ai` skill's own
   gate requires an explicit Done choice per service.
7. Run listing validation against the complete array.
8. Fix every blocking validation issue.
9. Create/register the ASP.
10. List it on OKX.AI.
11. Monitor the registered email for the review result.
12. Do not change public route paths during review.
