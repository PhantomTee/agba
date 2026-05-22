"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATEGORY_COLORS } from "@/lib/constants";
import { formatUsdc } from "@/lib/odds";
import type { Bet, Market } from "@/lib/types";

type PredictionActivity = Bet & {
  markets: Pick<Market, "id" | "question" | "category" | "country" | "resolved" | "outcome"> | null;
};

export function PredictionActivityClient() {
  const [predictions, setPredictions] = useState<PredictionActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/activity?limit=100")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load prediction activity");
        setPredictions(data.predictions || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load prediction activity"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="border-b border-white/10 pb-8">
        <p className="mb-2 text-sm font-black uppercase tracking-[0.28em] text-[#f5a623]">Prediction history</p>
        <h1 className="font-display text-5xl font-black leading-none text-white md:text-6xl">Market Activity</h1>
      </div>

      {loading && <p className="py-12 text-white/45">Loading prediction activity...</p>}
      {error && <p className="my-6 border border-red-500/40 p-4 text-sm text-red-200">{error}</p>}
      {!loading && !error && predictions.length === 0 && <p className="py-16 text-white/40">No predictions yet.</p>}

      {!loading && !error && predictions.length > 0 && (
        <section className="mt-8 border-t border-white/10">
          {predictions.map((prediction) => (
            <article key={prediction.id} className="grid gap-4 border-b border-white/10 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-black ${prediction.side ? "bg-[#f5a623] text-black" : "bg-[#2d6a4f] text-white"}`}>
                    {prediction.side ? "YES" : "NO"}
                  </span>
                  {prediction.markets && (
                    <span className="px-2 py-1 text-xs font-black text-black" style={{ backgroundColor: CATEGORY_COLORS[prediction.markets.category] }}>
                      {prediction.markets.category}
                    </span>
                  )}
                  <span className="font-mono text-xs text-white/45">
                    {prediction.wallet_address.slice(0, 6)}...{prediction.wallet_address.slice(-4)}
                  </span>
                  <span className="text-xs text-white/35">{new Date(prediction.created_at).toLocaleString()}</span>
                </div>
                {prediction.markets ? (
                  <Link href={`/market/${prediction.market_id}`} className="font-display text-2xl font-black leading-tight text-white hover:text-[#f5a623]">
                    {prediction.markets.question}
                  </Link>
                ) : (
                  <p className="font-display text-2xl font-black leading-tight text-white/55">Market unavailable</p>
                )}
                {prediction.markets && (
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-white/40">
                    {prediction.markets.country || "AFRICA"} - {prediction.markets.resolved ? `Resolved ${prediction.markets.outcome ? "YES" : "NO"}` : "Open market"}
                  </p>
                )}
              </div>
              <div className="text-left md:text-right">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">Stake</p>
                <p className="mt-1 text-xl font-black text-white"> {formatUsdc(prediction.amount_usdc)} USDC</p>
                {prediction.markets && (
                  <Link href={`/market/${prediction.market_id}`} className="mt-2 inline-block text-sm font-bold text-[#f5a623] hover:underline">
                    View market
                  </Link>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
