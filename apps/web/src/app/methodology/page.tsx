import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Methodology — Probable",
  description: "Data sources, formulas, thresholds, and known limitations behind Probable's calculations.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 text-sm text-black/70 dark:text-white/70 space-y-2">{children}</div>
    </section>
  );
}

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold mt-4">Methodology</h1>
      <p className="mt-2 text-sm text-black/70 dark:text-white/70">
        Current version: <strong>1.0.0</strong>. Every report links the exact version used to
        generate it. A formula or threshold change is a release blocker until the version bumps.
      </p>

      <Section title="Data sources">
        <p>
          All market data comes from Polymarket&apos;s public Gamma, CLOB, and Data APIs.
          Probable never places, cancels, or manages orders, and never requests or stores a
          Polymarket private key or API credential.
        </p>
      </Section>

      <Section title="Price-selection hierarchy">
        <ol className="list-decimal list-inside space-y-1">
          <li>Order-book midpoint, when both a best bid and best ask exist.</li>
          <li>Recent last trade (within 10 minutes), when the book is empty or one-sided.</li>
          <li>Gamma&apos;s outcome price snapshot, when no live CLOB data is available.</li>
          <li>
            <code>INSUFFICIENT_MARKET_DATA</code> — returned explicitly rather than inventing a
            price.
          </li>
        </ol>
        <p>Every non-midpoint price carries an explicit warning naming which fallback was used.</p>
      </Section>

      <Section title="Probability vs. confidence">
        <p>
          The displayed probability is the market&apos;s current price — what traders are willing
          to pay, not a statement of certainty. <strong>Signal confidence</strong> is a separate
          heuristic measuring how trustworthy that price is, given liquidity, related-market
          agreement, and resolution-rule clarity. It is never a statistical confidence interval
          and never a prediction of the real-world outcome.
        </p>
        <p>
          <code>signal_confidence = 0.60 × market_quality + 0.25 × related_market_agreement + 0.15 × resolution_clarity</code>,
          where <code>resolution_clarity = 100 − resolution_risk</code>. Grades: 80–100 HIGH,
          60–79 MODERATE, 40–59 LOW, 0–39 VERY_LOW.
        </p>
      </Section>

      <Section title="Percentage points vs. percent change">
        <p>
          A move from 40% to 48% is reported as <strong>+8 percentage points</strong>, never
          &quot;+8%&quot; (which would mean 40% → 43.2%). All movement figures in Probable use
          percentage points.
        </p>
      </Section>

      <Section title="Market-quality score">
        <p>
          <code>
            0.25 × spread_score + 0.25 × depth_score + 0.20 × activity_score + 0.15 ×
            open_interest_score + 0.10 × freshness_score + 0.05 × concentration_score
          </code>
        </p>
        <p>
          Every component is returned alongside the total — a score without its components is
          considered incomplete. Depth, activity, and open-interest scores use a log scale so
          that early liquidity counts more than later liquidity at the margin. Top-holder
          concentration is approximated from Polymarket&apos;s visible top holders, not true
          total supply (which the public API doesn&apos;t expose).
        </p>
      </Section>

      <Section title="Resolution risk weights">
        <p>An LLM extracts findings and their exact evidence spans only — it never assigns the score.</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Missing resolution source: +25</li>
          <li>Ambiguous or conflicting deadline: +20</li>
          <li>Timezone omission: +5</li>
          <li>Undefined decisive term: +15</li>
          <li>Subjective decisive verb: +15</li>
          <li>Question/description conflict: +20</li>
          <li>Overlapping or non-exhaustive outcomes: +15</li>
          <li>Missing edge case: +10</li>
          <li>Other finding: +3 / +7 / +12 (low / medium / high)</li>
        </ul>
        <p>Capped at 100. Bands: 0–19 LOW, 20–39 MEDIUM, 40–69 HIGH, 70–100 CRITICAL.</p>
        <p>
          A finding is dropped — never shown — if its cited evidence isn&apos;t an exact,
          locatable substring of the market&apos;s actual text.
        </p>
      </Section>

      <Section title="Contradiction scan buffers">
        <p>
          <strong>Multi-outcome sum</strong> (mutually-exclusive outcome groups): flagged only
          when the combined price exceeds 1.0 by more than a 3-percentage-point base buffer plus
          half of each market&apos;s visible spread — never on a bare excess above zero.
        </p>
        <p>
          <strong>Near-duplicate</strong>: two markets with near-identical wording and the exact
          same stated deadline, priced more than the requested minimum edge (default 3 pp) apart.
          This is a lexical-similarity check, not a verified semantic equivalence — every result
          is labeled a <em>candidate inconsistency requiring manual verification</em>, never
          &quot;arbitrage&quot; or &quot;certain mispricing.&quot;
        </p>
        <p>
          A third mode, logical implication between related markets, requires an LLM relation
          classifier and is not yet implemented — it is accepted as a request parameter but
          produces no candidates, with an explicit warning rather than a silent no-op.
        </p>
      </Section>

      <Section title="Known limitations">
        <ul className="list-disc list-inside space-y-1">
          <li>Search relevance currently uses lexical token overlap, not an LLM-based semantic reranker.</li>
          <li>The last-trade fallback (hierarchy step 2) isn&apos;t wired up yet; pricing falls straight from the order book to Gamma&apos;s snapshot price.</li>
          <li>No caching layer yet — every response is currently a live read.</li>
          <li>Holder concentration is a proxy among visible top holders, not total supply.</li>
        </ul>
      </Section>

      <footer className="mt-12 pt-6 border-t border-black/10 dark:border-white/10 text-xs text-black/40 dark:text-white/40">
        Probable is a probability intelligence layer, not a source of guaranteed outcomes,
        guaranteed arbitrage, or financial advice.
      </footer>
    </main>
  );
}
