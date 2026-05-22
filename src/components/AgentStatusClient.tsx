"use client";

import { useEffect, useState } from "react";
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
          {Object.keys(stats.marketsByCategory).length === 0 ? (
            <p className="mt-4 text-sm text-white/50">No markets yet.</p>
          ) : (
            <>
              <DonutChart data={stats.marketsByCategory} />
              <div className="mt-4 space-y-2">
                {Object.entries(stats.marketsByCategory).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] ?? "#6b7280" }} />
                      <span className="text-xs font-bold text-white/70">{cat}</span>
                    </div>
                    <span className="text-xs text-white/45 tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
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

const CATEGORY_COLORS: Record<string, string> = {
  FOREX:       "#f5a623",
  POLITICS:    "#e63946",
  SPORTS:      "#2d9d57",
  ECONOMY:     "#457b9d",
  SECURITY:    "#9c4dc1",
  COMMODITIES: "#f4a261",
  TECH:        "#2a9d8f",
  OTHER:       "#6b7280",
};

function DonutChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;

  const r = 42;
  const circ = 2 * Math.PI * r;

  // Pre-compute each segment's start angle (degrees, 0 = 12 o'clock = -90 from SVG default)
  const segs = entries.map(([cat, count], i) => {
    const prevCount = entries.slice(0, i).reduce((s, [, v]) => s + v, 0);
    return {
      cat,
      arc: (count / total) * circ,
      angle: (prevCount / total) * 360 - 90,
    };
  });

  return (
    <svg viewBox="0 0 120 120" className="mt-4 w-full max-w-[180px] mx-auto">
      {segs.map(({ cat, arc, angle }) => (
        <circle
          key={cat}
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={CATEGORY_COLORS[cat] ?? "#6b7280"}
          strokeWidth="16"
          strokeDasharray={`${arc} ${circ}`}
          transform={`rotate(${angle} 60 60)`}
        />
      ))}
      {/* inner fill to create donut hole */}
      <circle cx="60" cy="60" r="34" fill="black" />
      {/* centre label */}
      <text x="60" y="56" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="sans-serif">
        {total}
      </text>
      <text x="60" y="70" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="sans-serif">
        markets
      </text>
    </svg>
  );
}
