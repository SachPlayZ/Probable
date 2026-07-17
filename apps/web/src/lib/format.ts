import { Decimal } from "decimal.js";

/**
 * AGENTS.md §16 data-formatting rules — never more precision than the source
 * supports, and (per AGENTS.md §8) never round a domain value with native
 * float toFixed: `(0.15).toFixed(1)` is `"0.1"`, not `"0.2"`, because 0.15
 * isn't exactly representable in binary floating point. Decimal.js rounds
 * the decimal string exactly as written instead.
 */

function decimalToFixed(value: string, places: number): string | undefined {
  const d = new Decimal(value);
  if (d.isNaN()) return undefined;
  return d.toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toFixed(places);
}

export function formatProbability(percentString: string | undefined): string {
  if (percentString === undefined) return "—";
  const fixed = decimalToFixed(percentString, 1);
  return fixed === undefined ? "—" : `${fixed}%`;
}

export function formatChangePp(ppString: string | undefined): string {
  if (ppString === undefined) return "—";
  const d = new Decimal(ppString);
  if (d.isNaN()) return "—";
  const fixed = decimalToFixed(ppString, 1)!;
  const sign = d.gt(0) ? "+" : "";
  return `${sign}${fixed} pp`;
}

export function formatSpread(spread: string | undefined, spreadBps: string | undefined): string {
  if (spread === undefined) return "—";
  const pp = decimalToFixed(new Decimal(spread).times(100).toString(), 1);
  const bps = spreadBps !== undefined ? decimalToFixed(spreadBps, 0) : undefined;
  if (pp === undefined) return "—";
  return `${pp} pp${bps !== undefined ? ` (${bps} bps)` : ""}`;
}

export function formatUsd(value: string | number | undefined): string {
  if (value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function formatTimestamp(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return (
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date) + " UTC"
  );
}

export function formatScore(score: number | undefined): string {
  if (score === undefined) return "—";
  return decimalToFixed(score.toString(), 0) ?? "—";
}
