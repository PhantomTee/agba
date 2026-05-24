"use client";

import { useEffect, useState } from "react";
import { formatTokenAmount } from "@/lib/odds";

type Row = { wallet: string; volume: number; won: number; settled: number; correct: number; accuracy: number };

export function LeaderboardClient() {
  const [data, setData] = useState<{ byVolume: Row[]; byWon: Row[]; byAccuracy: Row[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/leaderboard")
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Unable to load leaderboard");
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load leaderboard"))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <main className="mx-auto max-w-7xl px-4 py-12 text-white/55">Loading leaderboard...</main>;
  if (error) return <main className="mx-auto max-w-7xl px-4 py-12 text-red-200">{error}</main>;
  if (!data) return <main className="mx-auto max-w-7xl px-4 py-12 text-white/55">No leaderboard data yet.</main>;
  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="font-display text-6xl font-black text-white">Leaderboard</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <Table title="Top USDC Won" rows={data.byWon} metric={(row) => formatTokenAmount(row.won, "USDC")} />
        <Table title="Top Accuracy" rows={data.byAccuracy} metric={(row) => `${Math.round(row.accuracy * 100)}%`} />
        <Table title="Top Volume" rows={data.byVolume} metric={(row) => formatTokenAmount(row.volume, "USDC")} />
      </div>
    </main>
  );
}

function Table({ title, rows, metric }: { title: string; rows: Row[]; metric: (row: Row) => string }) {
  return (
    <section className="border border-white/10 p-5">
      <h2 className="font-display text-2xl font-black text-[#f5a623]">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-white/50">No bets yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <div key={row.wallet} className="flex items-center justify-between gap-4 border-b border-white/10 pb-3 text-sm">
              <span className="font-mono text-white/70">
                {row.wallet.slice(0, 6)}…{row.wallet.slice(-4)}
              </span>
              <span className="font-bold text-white">{metric(row)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
