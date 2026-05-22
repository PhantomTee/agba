"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { CATEGORY_COLORS } from "@/lib/constants";
import { formatUsdc } from "@/lib/odds";
import type { Bet, Market } from "@/lib/types";

export type PredictionActivity = Bet & {
  markets: Pick<Market, "id" | "question" | "category" | "country" | "resolved" | "outcome"> | null;
};

type ActivityView = "all" | "mine";

export function PredictionActivityClient({ initialPredictions = [] }: { initialPredictions?: PredictionActivity[] }) {
  const { address, isConnected } = useAccount();
  const [view, setView] = useState<ActivityView>("all");
  const [predictions, setPredictions] = useState<PredictionActivity[]>(initialPredictions);
  const [loading, setLoading] = useState(initialPredictions.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadPredictions = useCallback((showLoading = false) => {
    if (view === "mine" && (!isConnected || !address)) {
      setPredictions([]);
      setLoading(false);
      setRefreshing(false);
      setError("");
      return;
    }

    const params = new URLSearchParams({ limit: "100" });
    if (view === "mine" && address) params.set("wallet", address);
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    setError("");

    fetch(`/api/activity?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load prediction activity");
        setPredictions(data.predictions || []);
        setLastUpdated(new Date());
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load prediction activity"))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [address, isConnected, view]);

  useEffect(() => {
    loadPredictions(true);
    const interval = window.setInterval(() => loadPredictions(false), 15_000);
    return () => window.clearInterval(interval);
  }, [loadPredictions]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="border-b border-white/10 pb-8 md:flex md:items-end md:justify-between md:gap-6">
        <div>
          <p className="mb-2 text-sm font-black uppercase tracking-[0.28em] text-[#f5a623]">Prediction history</p>
          <h1 className="font-display text-5xl font-black leading-none text-white md:text-6xl">
            {view === "mine" ? "My Latest Bets" : "Market Activity"}
          </h1>
          <p className="mt-3 text-sm text-white/45">
            {view === "mine" && isConnected && address
              ? `${address.slice(0, 6)}...${address.slice(-4)}`
              : "Switch between all recent bets and your wallet's latest bets."}
            {lastUpdated ? ` Last updated ${lastUpdated.toLocaleTimeString()}.` : ""}
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 md:mt-0">
          <div className="flex border border-white/15">
            <button
              onClick={() => setView("all")}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest ${
                view === "all" ? "bg-[#f5a623] text-black" : "text-white/65 hover:text-white"
              }`}
            >
              All activity
            </button>
            <button
              onClick={() => setView("mine")}
              disabled={!isConnected || !address}
              className={`border-l border-white/15 px-4 py-2 text-xs font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40 ${
                view === "mine" ? "bg-[#f5a623] text-black" : "text-white/65 hover:text-white"
              }`}
            >
              My bets
            </button>
          </div>
          <button
            onClick={() => loadPredictions(false)}
            disabled={refreshing || (view === "mine" && (!isConnected || !address))}
            className="border border-white/15 px-4 py-2 text-sm font-black text-white/70 hover:border-[#f5a623] hover:text-[#f5a623] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {loading && <p className="py-12 text-white/45">Loading prediction activity...</p>}
      {error && <p className="my-6 border border-red-500/40 p-4 text-sm text-red-200">{error}</p>}
      {!loading && !error && predictions.length === 0 && (
        <p className="py-16 text-white/40">{view === "mine" ? "No bets found for this wallet yet." : "No predictions yet."}</p>
      )}

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
