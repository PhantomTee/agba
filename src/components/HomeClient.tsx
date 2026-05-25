"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MarketCard } from "./MarketCard";
import { ReadingRoom } from "./ReadingRoom";
import type { Market } from "@/lib/types";

export function HomeClient() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/markets?status=open&limit=6")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load markets");
        setMarkets(data.markets);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load markets"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto grid max-w-7xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        {/* Hero */}
        <div className="border-b border-white/10 pb-8">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.28em] text-[#f5a623]">
            Africa&apos;s prediction market
          </p>
          <h1 className="font-display text-5xl font-black leading-none text-white md:text-7xl">
            Built by Africans,<br />for African news.
          </h1>
          <p className="mt-4 max-w-lg text-base text-white/55">
            AI scans African news every 15 minutes and creates live binary markets. Bet USDC on outcomes — politics, forex, sports, economy.
          </p>
          <Link
            href="/markets"
            className="mt-6 inline-block bg-[#f5a623] px-6 py-3 text-sm font-black text-black hover:bg-[#f5a623]/90"
          >
            Browse all markets →
          </Link>
        </div>

        {/* Recent markets */}
        <div className="mt-8 mb-4 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-white/45">Latest open markets</h2>
          <Link href="/markets" className="text-xs font-bold text-[#f5a623] hover:underline">
            View all →
          </Link>
        </div>

        {loading && <p className="py-10 text-white/40">Loading markets...</p>}
        {error && <p className="my-4 border border-red-500/40 p-4 text-sm text-red-200">{error}</p>}
        {!loading && !error && markets.length === 0 && (
          <p className="py-10 text-white/40">No markets yet — agent is scanning.</p>
        )}
        {markets.map((market) => (
          <MarketCard key={market.id} market={market} />
        ))}
        {!loading && markets.length > 0 && (
          <Link
            href="/markets"
            className="mt-6 block border border-white/10 py-4 text-center text-sm font-black text-white/60 hover:border-[#f5a623] hover:text-[#f5a623]"
          >
            See all markets →
          </Link>
        )}
      </section>

      <ReadingRoom />
    </main>
  );
}
