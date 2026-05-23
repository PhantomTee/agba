"use client";

import { useState } from "react";

type YieldMarketControl = {
  id: number;
  question: string;
  eligibleIdle: number;
};

export function YieldOpsControls({ markets }: { markets: YieldMarketControl[] }) {
  const [apiKey, setApiKey] = useState("");
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<Record<number, { loading: boolean; message: string; error: string }>>({});

  const eligibleMarkets = markets.filter((market) => market.eligibleIdle > 0);

  function setMarketStatus(marketId: number, next: Partial<{ loading: boolean; message: string; error: string }>) {
    setStatus((current) => ({
      ...current,
      [marketId]: { ...(current[marketId] || { loading: false, message: "", error: "" }), ...next },
    }));
  }

  async function invest(market: YieldMarketControl) {
    if (!apiKey.trim()) {
      setMarketStatus(market.id, { error: "Enter the admin API key first." });
      return;
    }
    const amountUsdc = Number(amounts[market.id] || market.eligibleIdle);
    if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
      setMarketStatus(market.id, { error: "Enter a valid USDC amount." });
      return;
    }
    setMarketStatus(market.id, { loading: true, error: "", message: "" });
    try {
      const response = await fetch("/api/admin/invest-usyc", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ marketId: market.id, amountUsdc }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Investment failed");
      setMarketStatus(market.id, { loading: false, message: `Invested ${data.investedUsdc} USDC. Tx: ${data.txHash}`, error: "" });
    } catch (error) {
      setMarketStatus(market.id, { loading: false, error: error instanceof Error ? error.message : "Investment failed" });
    }
  }

  return (
    <div className="border border-white/10 p-5">
      <h2 className="font-display text-2xl font-black text-[#f5a623]">Admin invest</h2>
      <p className="mt-2 text-sm text-white/55">Move eligible locked market USDC into USYC. Redemptions happen during market resolution.</p>
      <input
        type="password"
        value={apiKey}
        onChange={(event) => setApiKey(event.target.value)}
        placeholder="Admin API key"
        className="mt-4 w-full border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#f5a623]"
      />
      <div className="mt-4 space-y-4">
        {eligibleMarkets.length === 0 ? <p className="text-sm text-white/40">No eligible idle USDC right now.</p> : null}
        {eligibleMarkets.map((market) => {
          const current = status[market.id] || { loading: false, message: "", error: "" };
          return (
            <div key={market.id} className="border-t border-white/10 pt-4">
              <p className="line-clamp-2 text-sm font-bold text-white">#{market.id} {market.question}</p>
              <p className="mt-1 text-xs text-white/45">Eligible: {market.eligibleIdle.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC</p>
              <div className="mt-3 flex gap-2">
                <input
                  value={amounts[market.id] ?? String(market.eligibleIdle)}
                  onChange={(event) => setAmounts((currentAmounts) => ({ ...currentAmounts, [market.id]: event.target.value }))}
                  className="min-w-0 flex-1 border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#f5a623]"
                />
                <button
                  onClick={() => invest(market)}
                  disabled={current.loading}
                  className="bg-[#f5a623] px-3 py-2 text-xs font-black text-black disabled:opacity-50"
                >
                  {current.loading ? "Investing" : "Invest"}
                </button>
              </div>
              {current.message && <p className="mt-2 break-words text-xs text-[#2d6a4f]">{current.message}</p>}
              {current.error && <p className="mt-2 text-xs text-red-300">{current.error}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
