"use client";

import { useEffect, useState } from "react";
import { PolymarketBuilderPanel } from "./PolymarketBuilderPanel";

type Stats = {
  totalMarkets: number;
  openMarkets: number;
  totalVolumeUSDC: number;
  marketsByCategory: Record<string, number>;
  marketsByCountry: Record<string, number>;
  articlesScanned: number;
  conversionRate: string;
};

type PendingResolution = {
  id: string;
  market_id: number;
  created_at: string;
  markets: { question: string; category: string; country: string | null } | null;
};

export function AgentStatusClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [feed, setFeed] = useState<Array<{ id: string; headline: string; source_name: string; groq_reasoning: string | null; market_created: boolean }>>([]);
  const [pending, setPending] = useState<PendingResolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([fetch("/api/stats"), fetch("/api/news/feed"), fetch("/api/pending-resolutions")])
      .then(async ([statsResponse, feedResponse, pendingResponse]) => {
        const statsJson = await statsResponse.json();
        const feedJson = await feedResponse.json();
        const pendingJson = await pendingResponse.json();
        if (!statsResponse.ok) throw new Error(statsJson.error || "Unable to load stats");
        if (!feedResponse.ok) throw new Error(feedJson.error || "Unable to load agent log");
        if (!pendingResponse.ok) throw new Error(pendingJson.error || "Unable to load pending resolutions");
        setStats(statsJson);
        setFeed(feedJson.items.slice(0, 20));
        setPending(pendingJson.pending || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load agent status"))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <main className="mx-auto max-w-7xl px-4 py-12 text-white/55">Loading agent status...</main>;
  if (error) return <main className="mx-auto max-w-7xl px-4 py-12 text-red-200">{error}</main>;
  if (!stats) return <main className="mx-auto max-w-7xl px-4 py-12 text-white/55">No agent status available yet.</main>;
  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="font-display text-6xl font-black text-white">Agent Status</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="Articles scanned" value={String(stats.articlesScanned)} />
        <Metric label="Markets" value={String(stats.totalMarkets)} />
        <Metric label="Open markets" value={String(stats.openMarkets)} />
        <Metric label="Conversion" value={stats.conversionRate} />
      </div>
      <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="font-display text-3xl font-black text-white">Live decisions</h2>
          {feed.length === 0 ? <p className="mt-4 text-white/50">No agent decisions yet.</p> : null}
          {feed.map((item) => (
            <article key={item.id} className="border-b border-white/10 py-4">
              <div className="text-sm font-bold text-white">{item.headline}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/35">{item.market_created ? "Created market" : "Passed"}</div>
              {item.groq_reasoning && <p className="mt-2 text-sm text-white/55">{item.groq_reasoning}</p>}
            </article>
          ))}
        </div>
        <div className="border border-white/10 p-5">
          <h2 className="font-display text-2xl font-black text-[#f5a623]">Categories</h2>
          <svg viewBox="0 0 120 120" className="mt-4 aspect-square w-full">
            <circle cx="60" cy="60" r="48" fill="none" stroke="#ffffff22" strokeWidth="18" />
            {Object.entries(stats.marketsByCategory).map(([category, count], index) => (
              <circle key={category} cx="60" cy="60" r={36 + index * 3} fill="none" stroke="#f5a623" strokeWidth="2" strokeDasharray={`${count * 10} 360`} />
            ))}
          </svg>
        </div>
      </section>
      <section className="mt-10 border border-white/10 p-5">
        <h2 className="font-display text-2xl font-black text-[#f5a623]">Pending resolution queue</h2>
        {pending.length === 0 ? <p className="mt-4 text-sm text-white/50">No pending resolutions.</p> : null}
        <div className="mt-4 space-y-3">
          {pending.map((item) => (
            <div key={item.id} className="border-b border-white/10 pb-3">
              <div className="text-sm font-bold text-white">{item.markets?.question || `Market #${item.market_id}`}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/35">
                {item.markets?.category || "UNKNOWN"} · {item.markets?.country || "AFRICA"} · queued {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </section>
      <PolymarketBuilderPanel />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 p-5">
      <div className="text-xs font-black uppercase tracking-[0.2em] text-white/40">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}
