"use client";

import { useState } from "react";

const BRIDGE_CHAINS = ["Ethereum_Sepolia", "Base_Sepolia", "Arbitrum_Sepolia", "Optimism_Sepolia", "Arc_Testnet"];

export function BridgeClient() {
  const [fromChain, setFromChain] = useState("Base_Sepolia");
  const [toChain, setToChain] = useState("Arc_Testnet");
  const [amount, setAmount] = useState("");
  const [estimate, setEstimate] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function estimateBridge() {
    setLoading(true);
    setError("");
    setEstimate(null);
    try {
      const response = await fetch("/api/bridge/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromChain, toChain, amount }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to estimate bridge transfer");
      setEstimate(data.estimate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to estimate bridge transfer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <p className="text-sm font-black uppercase tracking-[0.28em] text-[#f5a623]">Circle CCTP</p>
      <h1 className="mt-4 font-display text-6xl font-black leading-none text-white">Bridge USDC to Arc.</h1>
      <div className="mt-10 grid gap-5 border border-white/10 p-5 md:grid-cols-3">
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white/45">From</span>
          <select value={fromChain} onChange={(event) => setFromChain(event.target.value)} className="mt-2 w-full bg-black p-3 text-white">
            {BRIDGE_CHAINS.map((chain) => (
              <option key={chain} value={chain}>
                {chain}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white/45">To</span>
          <select value={toChain} onChange={(event) => setToChain(event.target.value)} className="mt-2 w-full bg-black p-3 text-white">
            {BRIDGE_CHAINS.map((chain) => (
              <option key={chain} value={chain}>
                {chain}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white/45">USDC amount</span>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 w-full bg-black p-3 text-white" inputMode="decimal" />
        </label>
        <button onClick={estimateBridge} disabled={loading} className="bg-[#f5a623] px-5 py-4 text-sm font-black text-black disabled:opacity-50 md:col-span-3">
          {loading ? "Estimating..." : "Estimate bridge"}
        </button>
      </div>
      {error && <p className="mt-5 border border-red-500/40 p-4 text-sm text-red-200">{error}</p>}
      {estimate && typeof estimate === "object" && estimate !== null ? (
        <div className="mt-5 border border-white/10 p-5">
          <h2 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-[#f5a623]">Estimate</h2>
          <div className="space-y-3">
            {Object.entries(estimate as Record<string, unknown>).map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-4 border-b border-white/10 pb-3">
                <span className="text-xs uppercase tracking-[0.15em] text-white/45">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </span>
                <span className="text-right text-sm font-bold text-white">
                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {!estimate && !error && !loading ? (
        <p className="mt-5 text-sm text-white/50">Enter an amount and click Estimate bridge to see fees and timing.</p>
      ) : null}
    </main>
  );
}
