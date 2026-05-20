"use client";

import { useEffect, useState } from "react";
import { formatUsdc } from "@/lib/odds";

type BuilderTrade = {
  id: string;
  market: string;
  side: string;
  sizeUsdc: string;
  builderFee: string;
  builderCode: string;
  createdAt: string | null;
};

export function PolymarketBuilderPanel() {
  const [trades, setTrades] = useState<BuilderTrade[]>([]);
  const [builderCode, setBuilderCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/polymarket/builder-trades")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load Polymarket builder trades");
        setBuilderCode(data.builderCode);
        setTrades(data.trades || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load Polymarket builder trades"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="mt-10 border border-white/10 p-5">
      <h2 className="font-display text-2xl font-black text-[#f5a623]">Polymarket V2 builder fees</h2>
      {loading && <p className="mt-4 text-sm text-white/50">Loading builder trades...</p>}
      {error && <p className="mt-4 text-sm text-red-200">{error}</p>}
      {!loading && !error && trades.length === 0 && <p className="mt-4 text-sm text-white/50">No builder-fee trades yet.</p>}
      {builderCode && <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/35">Builder code: {builderCode}</p>}
      <div className="mt-4 space-y-3">
        {trades.slice(0, 8).map((trade) => (
          <div key={trade.id} className="grid gap-2 border-b border-white/10 pb-3 text-sm md:grid-cols-[1fr_auto_auto]">
            <span className="truncate text-white/70">{trade.market}</span>
            <span className="font-bold text-white">{trade.side}</span>
            <span className="text-[#f5a623]">fee USDC {formatUsdc(trade.builderFee)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
