import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getReport } from "@/lib/api";
import { formatChangePp, formatProbability, formatScore, formatSpread, formatTimestamp, formatUsd } from "@/lib/format";

interface PageProps {
  params: Promise<{ id: string }>;
}

const VERDICT_LABEL: Record<string, string> = {
  RULES_RISK_DOMINATES: "Rules risk dominates",
  WEAK_MARKET_SIGNAL: "Weak market signal",
  RELATED_MARKETS_DISAGREE: "Related markets disagree",
  STRONGER_MARKET_SIGNAL: "Stronger market signal",
  USE_WITH_CONTEXT: "Use with context",
};

const RISK_BAND_COLOR: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  HIGH: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200",
  CRITICAL: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
};

const CONFIDENCE_COLOR: Record<string, string> = {
  HIGH: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  MODERATE: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200",
  LOW: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  VERY_LOW: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const envelope = await getReport(id);
  if (!envelope) return { title: "Report not found — Probable" };

  const { data } = envelope;
  return {
    title: `${formatProbability(data.snapshot.implied_probability_percent)} — ${data.question} | Probable`,
    description: `Market-implied probability, signal confidence, and resolution risk for: ${data.question}`,
    openGraph: {
      title: data.question,
      description: `${formatProbability(data.snapshot.implied_probability_percent)} implied probability — ${VERDICT_LABEL[data.verdict] ?? data.verdict}`,
      type: "website",
    },
  };
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
      <div className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
      {sub ? <div className="text-xs text-black/50 dark:text-white/50 mt-1">{sub}</div> : null}
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${className}`}>
      {children}
    </span>
  );
}

export default async function ReportPage({ params }: PageProps) {
  const { id } = await params;
  const envelope = await getReport(id);
  if (!envelope) notFound();

  const { data, meta } = envelope;
  const { snapshot, vitals, resolution_audit, contradictions, signal_confidence } = data;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <Link href="/methodology" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
        Methodology &amp; disclaimers →
      </Link>

      <h1 className="text-xl sm:text-2xl font-semibold mt-4 leading-snug">{data.question}</h1>
      <p className="text-sm text-black/50 dark:text-white/50 mt-1">
        Outcome: {snapshot.outcome} · Data as of {formatTimestamp(meta.data_as_of)}
      </p>

      {/* Hero probability — AGENTS.md §16 visual priority #1 */}
      <section className="mt-8 text-center">
        <div className="text-6xl sm:text-7xl font-bold tabular-nums">
          {formatProbability(snapshot.implied_probability_percent)}
        </div>
        <div className="text-sm text-black/50 dark:text-white/50 mt-2">
          implied probability · priced via {snapshot.pricing_method.replaceAll("_", " ")}
        </div>
        {snapshot.changes_pp["24h"] !== undefined && (
          <div className="text-sm mt-1">
            {formatChangePp(snapshot.changes_pp["24h"])} over 24h
          </div>
        )}
      </section>

      {/* Verdict row */}
      <section className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Badge className="bg-black/5 dark:bg-white/10">{VERDICT_LABEL[data.verdict] ?? data.verdict}</Badge>
        <Badge className={CONFIDENCE_COLOR[signal_confidence.grade] ?? ""}>
          Signal confidence: {signal_confidence.grade} ({formatScore(signal_confidence.score)})
        </Badge>
        {resolution_audit && (
          <Badge className={RISK_BAND_COLOR[resolution_audit.risk_band] ?? ""}>
            Resolution risk: {resolution_audit.risk_band}
          </Badge>
        )}
      </section>
      <p className="text-xs text-center text-black/40 dark:text-white/40 mt-3 max-w-md mx-auto">
        {signal_confidence.disclaimer}
      </p>

      {/* Market quality & pricing detail */}
      <section className="mt-10 grid grid-cols-2 gap-3">
        <StatTile label="Best bid" value={snapshot.best_bid ?? "—"} />
        <StatTile label="Best ask" value={snapshot.best_ask ?? "—"} />
        <StatTile label="Spread" value={formatSpread(snapshot.spread, snapshot.spread_bps)} />
        {vitals && <StatTile label="Market quality" value={formatScore(vitals.quality_score)} sub="0–100 heuristic" />}
        {vitals?.open_interest_usd && <StatTile label="Open interest" value={formatUsd(vitals.open_interest_usd)} />}
        {vitals && (
          <StatTile
            label="24h volume"
            value={formatUsd(vitals.activity.recent_volume_usd)}
            sub={`${vitals.activity.recent_trade_count} trades`}
          />
        )}
      </section>

      {vitals && vitals.fills.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50 mb-3">
            Exit difficulty
          </h2>
          <div className="space-y-2 text-sm">
            {vitals.fills.map((fill) => (
              <div
                key={fill.trade_size_usd}
                className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 px-4 py-2"
              >
                <span>Sell {formatUsd(fill.trade_size_usd)}</span>
                <span className="font-medium capitalize">{fill.exit_difficulty}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {resolution_audit && resolution_audit.findings.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50 mb-3">
            Resolution audit findings
          </h2>
          <ul className="space-y-3 text-sm">
            {resolution_audit.findings.map((finding, i) => (
              <li key={i} className="rounded-lg border border-black/10 dark:border-white/10 p-3">
                <div className="font-medium capitalize">{finding.type.replaceAll("_", " ")} · {finding.severity}</div>
                <div className="text-black/70 dark:text-white/70 mt-1">{finding.explanation}</div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-black/40 dark:text-white/40 mt-2">{resolution_audit.disclaimer}</p>
        </section>
      )}

      {contradictions && contradictions.candidates.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50 mb-3">
            Related-market inconsistencies
          </h2>
          <ul className="space-y-3 text-sm">
            {contradictions.candidates.map((c, i) => (
              <li key={i} className="rounded-lg border border-black/10 dark:border-white/10 p-3">
                <div className="font-medium">{c.questions.join(" vs ")}</div>
                <div className="text-black/70 dark:text-white/70 mt-1">
                  {c.discrepancy_pp} pp gap · confidence: {c.confidence} · requires manual verification
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.warnings.length > 0 && (
        <section className="mt-8 text-xs text-black/40 dark:text-white/40 space-y-1">
          {data.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </section>
      )}

      <footer className="mt-12 pt-6 border-t border-black/10 dark:border-white/10 text-xs text-black/40 dark:text-white/40">
        <p>Methodology version {meta.methodology_version ?? "—"} · Generated {formatTimestamp(meta.generated_at)}</p>
        <p className="mt-1">
          Prediction-market prices are implied probabilities, not guaranteed outcomes. Not financial advice.
        </p>
      </footer>
    </main>
  );
}
