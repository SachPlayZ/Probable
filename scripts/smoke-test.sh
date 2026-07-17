#!/usr/bin/env bash
# Production/preview smoke test — PLAN.md §21.6. Run after every deployment.
#
# Usage: ./scripts/smoke-test.sh https://api.probable.example.com
set -euo pipefail

BASE_URL="${1:?Usage: smoke-test.sh <base-url>}"
FAIL=0

pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; FAIL=1; }

echo "== /health/live =="
status=$(curl -s -o /tmp/smoke-health.json -w "%{http_code}" "$BASE_URL/health/live")
[ "$status" = "200" ] && pass "200 OK" || fail "expected 200, got $status"
cat /tmp/smoke-health.json
echo

echo "== POST /v1/search (free — must never emit a payment challenge) =="
headers=$(curl -s -D - -o /tmp/smoke-search.json -X POST "$BASE_URL/v1/search" \
  -H 'content-type: application/json' \
  --data '{"query":"Will Bitcoin reach a specified price?"}')
status=$(echo "$headers" | head -1 | awk '{print $2}')
# 200 (match) and 404/409 (no match / ambiguous — depends on live Polymarket listings
# at request time) are all legitimate free-route outcomes; the one thing that must
# never happen on a free route is an x402 challenge.
if echo "$headers" | grep -qi "^payment-required:"; then
  fail "free route emitted a PAYMENT-REQUIRED header (status $status)"
else
  pass "no payment challenge emitted (status $status)"
fi

echo "== POST /v1/snapshot (paid, no payment header — expect 402) =="
headers=$(curl -s -D - -o /dev/null -X POST "$BASE_URL/v1/snapshot" \
  -H 'content-type: application/json' \
  --data '{"target":{"market_slug":"placeholder"},"outcome":"Yes"}')
status=$(echo "$headers" | head -1 | awk '{print $2}')
if [ "$status" = "402" ]; then
  pass "402 Payment Required"
  if echo "$headers" | grep -qi "^payment-required:"; then
    pass "PAYMENT-REQUIRED header present"
    challenge=$(echo "$headers" | grep -i "^payment-required:" | sed 's/^[Pp]ayment-[Rr]equired: *//' | tr -d '\r')
    decoded=$(echo "$challenge" | base64 -d 2>/dev/null || echo "DECODE_FAILED")
    if echo "$decoded" | grep -q '"x402Version"'; then
      pass "challenge decodes to valid x402 JSON"
      echo "$decoded" | python3 -m json.tool 2>/dev/null || echo "$decoded"
    else
      fail "challenge did not decode to valid JSON"
    fi
  else
    fail "no PAYMENT-REQUIRED header on 402 response"
  fi
else
  fail "expected 402, got $status"
fi

echo
if [ "$FAIL" -eq 0 ]; then
  echo "ALL CHECKS PASSED"
else
  echo "SOME CHECKS FAILED"
  exit 1
fi
