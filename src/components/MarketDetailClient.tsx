"use client";

import { useEffect, useState } from "react";
import { BetPanel } from "./BetPanel";
import { MarketCard } from "./MarketCard";
import { formatUsdc } from "@/lib/odds";
import type { Bet, Market } from "@/lib/types";

export function MarketDetailClient({ id }: { id: string }) {
  const [market, setMarket] = useState<Market | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [related, setRelated] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/markets/${id}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load market");
        setMarket(data.market);
        setBets(data.bets);
        setRelated(data.related);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load market"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-12 text-white/55">Loading market...</main>;
  if (error) return <main className="mx-auto max-w-7xl px-4 py-12 text-red-200">{error}</main>;
  if (!market) return <main className="mx-auto max-w-7xl px-4 py-12 text-white/55">Market not found.</main>;

  return (
    <main className="mx-auto grid max-w-7xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section>
        <p className="mb-3 text-sm font-black uppercase tracking-[0.28em] text-[#f5a623]">{market.category}</p>
        <h1 className="font-display text-5xl font-black leading-none text-white md:text-7xl">{market.question}</h1>
        <div className="mt-8 border-l border-[#f5a623] bg-white/[0.03] p-5">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/45">Resolution criteria</h2>
          <p className="mt-3 text-white">{market.resolution_criteria || "No resolution criteria recorded."}</p>
        </div>
        {market.news_items && (
          <a href={market.news_items.url} target="_blank" rel="noreferrer" className="mt-6 block border border-white/10 p-5 hover:border-[#f5a623]">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Source article</div>
            <div className="mt-2 text-xl font-bold text-white">{market.news_items.headline}</div>
            <div className="mt-2 text-sm text-white/45">{market.news_items.source_name}</div>
          </a>
        )}
        <div className="mt-10">
          <h2 className="font-display text-3xl font-black text-white">Bet history</h2>
          {bets.length === 0 ? (
            <p className="mt-4 text-white/50">No bets yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="text-white/45">
                  <tr>
                    <th className="border-b border-white/10 py-3">Wallet</th>
                    <th className="border-b border-white/10 py-3">Side</th>
                    <th className="border-b border-white/10 py-3">Amount</th>
                    <th className="border-b border-white/10 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {bets.map((bet) => (
                    <tr key={bet.id}>
                      <td className="border-b border-white/10 py-3 text-white/70">{bet.wallet_address}</td>
                      <td className="border-b border-white/10 py-3 font-bold text-white">{bet.side ? "YES" : "NO"}</td>
                      <td className="border-b border-white/10 py-3 text-white/70">USDC {formatUsdc(bet.amount_usdc)}</td>
                      <td className="border-b border-white/10 py-3 text-white/45">{new Date(bet.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      <aside className="space-y-8">
        <BetPanel market={market} />
        <div className="border border-white/10 p-5">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#f5a623]">Why Agba made this market</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/65">{market.news_items?.groq_reasoning || "No agent reasoning recorded."}</p>
        </div>
        <a href={`/api/og/${market.id}`} target="_blank" rel="noreferrer" className="block border border-white/10 px-4 py-3 text-center text-sm font-bold text-white/70 hover:text-white">
          Share image
        </a>
        <div>
          <h2 className="font-display text-2xl font-black text-white">Related</h2>
          {related.length === 0 && <p className="mt-3 text-sm text-white/50">No related markets yet.</p>}
          {related.map((item) => (
            <MarketCard key={item.id} market={item} />
          ))}
        </div>
      </aside>
    </main>
  );
}
