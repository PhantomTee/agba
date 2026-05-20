"use client";

import { useEffect, useState } from "react";
import { MarketCard } from "./MarketCard";
import { CATEGORIES, CATEGORY_COLORS } from "@/lib/constants";
import type { Market } from "@/lib/types";

export function MarketsClient() {
  const [category, setCategory] = useState<string>("ALL");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ status: "open" });
    if (category !== "ALL") params.set("category", category);
    setLoading(true);
    setError("");
    fetch(`/api/markets?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load markets");
        setMarkets(data.markets);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load markets"))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 border-b border-white/10 pb-8">
        <p className="mb-2 text-sm font-black uppercase tracking-[0.28em] text-[#f5a623]">Live markets</p>
        <h1 className="font-display text-5xl font-black leading-none text-white md:text-6xl">All Markets</h1>
      </div>

      {/* Filter pills */}
      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => setCategory("ALL")}
          className={`rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-widest transition-colors ${
            category === "ALL"
              ? "border-[#f5a623] bg-[#f5a623] text-black"
              : "border-white/15 text-white/60 hover:border-white/40 hover:text-white"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-widest transition-colors ${
              category === cat
                ? "border-transparent text-black"
                : "border-white/15 text-white/60 hover:border-white/40 hover:text-white"
            }`}
            style={category === cat ? { backgroundColor: CATEGORY_COLORS[cat] } : {}}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* States */}
      {loading && (
        <div className="space-y-px">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse border-b border-white/10 bg-white/[0.02]" />
          ))}
        </div>
      )}
      {error && <p className="border border-red-500/40 p-4 text-sm text-red-200">{error}</p>}
      {!loading && !error && markets.length === 0 && (
        <p className="py-16 text-center text-white/40">No {category !== "ALL" ? category : ""} markets open right now.</p>
      )}

      {/* Market list */}
      {!loading && !error && markets.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </main>
  );
}
