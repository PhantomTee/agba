"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BetPanel } from "./BetPanel";
import { MarketCard } from "./MarketCard";
import { formatUsdc } from "@/lib/odds";
import type { Bet, Market } from "@/lib/types";

export function MarketDetailClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const initialSide = searchParams.get("side") !== "no"; // default YES unless ?side=no
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

  function refreshBets() {
    fetch(`/api/markets/${id}`)
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        setBets(data.bets ?? []);
        if (data.market) setMarket(data.market);
      })
      .catch(() => {/* silent refresh — don't overwrite a working page with an error */});
  }

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-12 text-white/55">Loading market...</main>;
  if (error) return <main className="mx-auto max-w-7xl px-4 py-12 text-red-200">{error}</main>;
  if (!market) return <main className="mx-auto max-w-7xl px-4 py-12 text-white/55">Market not found.</main>;

  return (
    <main className="mx-auto grid max-w-7xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section>
        <p className="mb-3 text-sm font-black uppercase tracking-[0.28em] text-[#f5a623]">{market.category}</p>
        <h1 className="font-display text-5xl font-black leading-none text-white md:text-7xl">{market.question}</h1>
        <div className="mt-5 flex flex-wrap gap-3">
          {market.agent_seeded && <span className="text-xs font-black text-[#f5a623]">🤖 Agent seeded</span>}
          {market.usyc_invested && !market.resolved && <span className="text-xs font-black text-[#2d6a4f]">💰 Earning yield in USYC while open</span>}
          {market.resolved && Number(market.yield_earned || 0) > 0 && (
            <span className="text-xs font-black text-[#2d6a4f]">+${formatUsdc(Number(market.yield_earned || 0))} yield earned for winners</span>
          )}
        </div>
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
            <p className="mt-4 text-white/50">No bets yet — be the first.</p>
          ) : (
            <div className="mt-4 space-y-0">
              {bets.map((bet) => (
                <div key={bet.id} className="flex items-center justify-between border-b border-white/10 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 px-2 py-0.5 text-xs font-black ${bet.side ? "bg-[#f5a623] text-black" : "bg-[#2d6a4f] text-white"}`}>
                      {bet.side ? "YES" : "NO"}
                    </span>
                    <span className="font-mono text-xs text-white/50 truncate">
                      {bet.wallet_address.slice(0, 6)}…{bet.wallet_address.slice(-4)}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-bold text-white">{bet.currency || "USDC"} {formatUsdc(bet.amount_usdc)}</span>
                    <p className="text-xs text-white/35">{new Date(bet.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <aside className="space-y-8">
        <BetPanel market={market} initialSide={initialSide} onBetPlaced={refreshBets} />
        <div className="border border-white/10 p-5">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#f5a623]">Why Àgbà made this market</h2>
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
