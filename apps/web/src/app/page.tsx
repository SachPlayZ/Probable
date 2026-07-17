import Link from "next/link";

const SERVICES = [
  { name: "Market Search", price: "Free", desc: "Find matching Polymarket markets from a question or URL." },
  { name: "Probability Snapshot", price: "0.01 USDT", desc: "Current implied probability, movement, spread, quality." },
  { name: "Market Vitals", price: "0.03 USDT", desc: "Liquidity depth, fill cost, price impact, exit difficulty." },
  { name: "Resolution Guard", price: "0.05 USDT", desc: "Audit resolution wording for ambiguity and edge-case risk." },
  { name: "Contradiction Scan", price: "0.08 USDT", desc: "Candidate inconsistencies across related markets." },
  { name: "Full Intelligence Report", price: "0.10 USDT", desc: "All of the above, combined, with a shareable report." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:py-24 text-center">
      <h1 className="text-3xl sm:text-4xl font-bold">Probable</h1>
      <p className="mt-3 text-lg text-black/70 dark:text-white/70">
        What does the market actually believe?
      </p>
      <p className="mt-6 text-sm text-black/60 dark:text-white/60 max-w-md mx-auto">
        A live, financially-backed probability signal for AI agents and humans — sourced from
        Polymarket, delivered as independently-priced A2MCP endpoints on OKX.AI.
      </p>

      <div className="mt-10 grid gap-3 text-left">
        {SERVICES.map((s) => (
          <div
            key={s.name}
            className="rounded-lg border border-black/10 dark:border-white/10 p-4 flex items-start justify-between gap-4"
          >
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-black/60 dark:text-white/60 mt-0.5">{s.desc}</div>
            </div>
            <div className="text-sm font-medium whitespace-nowrap">{s.price}</div>
          </div>
        ))}
      </div>

      <Link href="/methodology" className="inline-block mt-10 text-sm text-blue-600 dark:text-blue-400 hover:underline">
        Read the methodology →
      </Link>

      <p className="mt-16 text-xs text-black/40 dark:text-white/40">
        Prediction-market prices are implied probabilities, not guaranteed outcomes. Not financial advice.
      </p>
    </main>
  );
}
