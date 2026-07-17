# 90-Second Demo Script

Per PLAN.md §25/§7 and the hackathon submission gate (AGENTS.md §25). Record
from a clean browser session, in incognito mode, against the real deployed
URLs — not localhost.

## Pre-recording checklist

- [ ] ASP deployed and registered (see `docs/okx-listing.md`)
- [ ] `scripts/smoke-test.sh <live-url>` passes fully, including the paid-route
      402 check with real OKX credentials configured
- [ ] At least one `/reports/[id]` page is pre-generated and loads correctly
- [ ] Wallet used for the on-camera paid call is funded

## Timeline

### 0–8s — Problem

> "AI answers future-facing questions confidently, but often without a live, financially backed signal."

### 8–18s — Product

> "Probable is an OKX.AI service that turns Polymarket data into trustworthy probability intelligence for humans and agents."

### 18–32s — Free discovery

Type: "Will the Fed cut rates before October?" into `POST /v1/search` (or the
landing page if a query UI exists by then). Show the free Market Search
finding relevant markets — no payment prompt.

### 32–48s — Paid call

Invoke Probability Snapshot. Briefly show the x402 payment challenge/flow and
the returned probability, 24-hour movement, spread, and timestamp.

### 48–64s — Quality, not just price

Open the `/reports/[id]` page for the same market. Point at market quality,
order-book depth, and signal-confidence components — the thing a bare price
number hides.

### 64–76s — Hidden risk

Show Resolution Guard identifying an ambiguous phrase or missing edge case on
a real market's resolution text.

### 76–84s — Agent-native revenue

Show the six separately priced services under one ASP; explain other agents
can call only what they need, at a fraction of a cent per call.

### 84–90s — Close

> "Probable: what does the market actually believe?"

## Known-good demo material (verified during development, may go stale)

These specific markets produced clean, illustrative results during
development — re-verify before recording, since Polymarket listings and
prices change continuously:

- **Thin-market exit risk**: `will-bitcoin-reach-100k-in-july-2026` — a
  deep-out-of-the-money market where Market Vitals correctly shows a $1,000
  sell as `partial_fill: true` / `exit_difficulty: hard` against ~$110 of
  visible bid depth, while a $100 sell fills easily. Good for the 48–64s beat.
- **Missing resolution source**: same market — Resolution Guard correctly
  flags `missing_resolution_source` (risk score 25, MEDIUM) since the market
  has no `resolutionSource` field set. Good for the 64–76s beat.
- **Real duplicate-market discrepancy**: the
  `what-price-will-bitcoin-hit-in-july-2026` event contained two
  identically-worded markets ("Will Bitcoin dip to $60,000 in July?") priced
  at 100% and 47.5% simultaneously. Contradiction Scan correctly flags this as
  a `candidate_near_duplicate_claim` requiring manual verification — a strong,
  concrete example for the 76–84s beat if it's still live.

## X launch post

```text
Most AI agents answer questions about the future from model intuition.

Probable gives them a live, financially backed prior.

Ask a question → find the matching Polymarket market → get:
• implied probability
• movement
• liquidity and exit quality
• resolution risk
• related-market inconsistencies

Built as multiple pay-per-call services on @OKXAI.

[90-second demo]
[ASP link]

#OKXAI
```

Do not claim Polymarket partnership or endorsement.
