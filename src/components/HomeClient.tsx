"use client";

import { useEffect, useState } from "react";
import { MarketCard } from "./MarketCard";
import { ReadingRoom } from "./ReadingRoom";
import type { Market } from "@/lib/types";

export function HomeClient({ category }: { category?: string }) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ status: "open" });
    if (category) params.set("category", category);
    setLoading(true);
    fetch(`/api/markets?${params.toString()}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load markets");
        setMarkets(data.markets);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load markets"))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <main className="mx-auto grid max-w-7xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <div className="border-b border-white/10 pb-8">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.28em] text-[#f5a623]">Africa&apos;s prediction market</p>
          <h1 className="font-display text-5xl font-black leading-none text-white md:text-7xl">Built by Africans, for African news.</h1>
        </div>
        {loading && <p className="py-10 text-white/55">Loading live markets...</p>}
        {error && <p className="my-8 border border-red-500/40 p-4 text-red-200">{error}</p>}
        {!loading && !error && markets.length === 0 && <p className="py-10 text-white/55">No markets yet.</p>}
        {markets.map((market) => (
          <MarketCard key={market.id} market={market} />
        ))}
      </section>
      <ReadingRoom />
    </main>
  );
}
