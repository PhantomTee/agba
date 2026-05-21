"use client";

import { useState } from "react";

const BRIDGE_CHAINS = [
  "Ethereum_Sepolia",
  "Base_Sepolia",
  "Arbitrum_Sepolia",
  "Optimism_Sepolia",
  "Arc_Testnet",
];

function chainLabel(raw: string) {
  return raw.replace(/_/g, " ");
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

type GasFeeStep = {
  name: string;
  token: string;
  blockchain: string;
  fees: { gas: number; gasPrice: number; fee: string };
};

type ProviderFee = { type: string; token: string; amount: string };

type BridgeEstimate = {
  token?: string;
  amount?: string;
  source?: { address: string; chain: string };
  destination?: { address: string; chain: string };
  gasFees?: GasFeeStep[];
  fees?: ProviderFee[];
};

const STEP_ICONS: Record<string, string> = {
  Approve: "1",
  Burn: "2",
  Mint: "3",
};

export function BridgeClient() {
  const [fromChain, setFromChain] = useState("Base_Sepolia");
  const [toChain, setToChain] = useState("Arc_Testnet");
  const [amount, setAmount] = useState("");
  const [estimate, setEstimate] = useState<BridgeEstimate | null>(null);
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
      setEstimate(data.estimate as BridgeEstimate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to estimate bridge transfer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      {/* Header */}
      <p className="text-sm font-black uppercase tracking-[0.28em] text-[#f5a623]">Circle CCTP</p>
      <h1 className="mt-3 font-display text-5xl font-black leading-none text-white">
        Bridge USDC<br />to Arc.
      </h1>
      <p className="mt-4 text-sm text-white/50">
        Move USDC cross-chain via Circle's native burn-and-mint protocol. No wrapping, no slippage.
      </p>

      {/* Form */}
      <div className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-white/45">From</span>
            <select
              value={fromChain}
              onChange={(e) => setFromChain(e.target.value)}
              className="mt-2 w-full bg-black border border-white/10 px-3 py-3 text-sm text-white focus:border-[#f5a623] focus:outline-none"
            >
              {BRIDGE_CHAINS.map((c) => (
                <option key={c} value={c}>{chainLabel(c)}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-white/45">To</span>
            <select
              value={toChain}
              onChange={(e) => setToChain(e.target.value)}
              className="mt-2 w-full bg-black border border-white/10 px-3 py-3 text-sm text-white focus:border-[#f5a623] focus:outline-none"
            >
              {BRIDGE_CHAINS.map((c) => (
                <option key={c} value={c}>{chainLabel(c)}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white/45">USDC amount</span>
          <div className="relative mt-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="w-full bg-black border border-white/10 px-3 py-3 pr-16 text-sm text-white placeholder:text-white/25 focus:border-[#f5a623] focus:outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-white/40 pointer-events-none">
              USDC
            </span>
          </div>
        </label>

        <button
          onClick={estimateBridge}
          disabled={loading || !amount}
          className="w-full bg-[#f5a623] px-5 py-4 text-sm font-black uppercase tracking-[0.15em] text-black transition-opacity disabled:opacity-40 hover:opacity-90"
        >
          {loading ? "Estimating…" : "Estimate bridge fees →"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 border border-red-500/40 bg-red-500/5 px-4 py-3">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {/* Estimate result */}
      {estimate && (
        <div className="mt-8 space-y-4">

          {/* Route summary */}
          <div className="border border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40 mb-4">Route</p>
            <div className="flex items-center gap-3">
              {/* Source */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/40 mb-1">From</p>
                <p className="text-sm font-bold text-white truncate">
                  {chainLabel(estimate.source?.chain ?? fromChain)}
                </p>
                {estimate.source?.address && (
                  <p className="mt-0.5 font-mono text-xs text-white/35">
                    {shortAddr(estimate.source.address)}
                  </p>
                )}
              </div>

              {/* Arrow */}
              <div className="shrink-0 text-[#f5a623] text-lg">→</div>

              {/* Destination */}
              <div className="flex-1 min-w-0 text-right">
                <p className="text-xs text-white/40 mb-1">To</p>
                <p className="text-sm font-bold text-white truncate">
                  {chainLabel(estimate.destination?.chain ?? toChain)}
                </p>
                {estimate.destination?.address && (
                  <p className="mt-0.5 font-mono text-xs text-white/35">
                    {shortAddr(estimate.destination.address)}
                  </p>
                )}
              </div>
            </div>

            {/* Amount being bridged */}
            <div className="mt-4 border-t border-white/10 pt-4 flex items-center justify-between">
              <span className="text-xs text-white/40 uppercase tracking-[0.15em]">Amount</span>
              <span className="text-lg font-black text-white">
                {estimate.amount ?? amount}{" "}
                <span className="text-[#f5a623]">{estimate.token ?? "USDC"}</span>
              </span>
            </div>
          </div>

          {/* Gas fee steps */}
          {estimate.gasFees && estimate.gasFees.length > 0 && (
            <div className="border border-white/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40 mb-4">
                Transaction steps
              </p>
              <div className="space-y-0">
                {estimate.gasFees.map((step, i) => (
                  <div
                    key={step.name}
                    className={`flex items-center gap-4 py-3 ${
                      i < estimate.gasFees!.length - 1 ? "border-b border-white/[0.06]" : ""
                    }`}
                  >
                    {/* Step number */}
                    <div className="shrink-0 w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-[10px] font-black text-white/50">
                      {STEP_ICONS[step.name] ?? i + 1}
                    </div>

                    {/* Step name + chain */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{step.name}</p>
                      <p className="text-xs text-white/35">{chainLabel(step.blockchain)}</p>
                    </div>

                    {/* Fee */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-white">
                        {Number(step.fees.fee).toFixed(6)}
                      </p>
                      <p className="text-xs text-white/40">{step.token}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Provider fees */}
          {estimate.fees && estimate.fees.length > 0 && (
            <div className="border border-white/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40 mb-4">
                Protocol fees
              </p>
              <div className="space-y-0">
                {estimate.fees.map((fee, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-sm text-white/60 capitalize">{fee.type} fee</span>
                    <span className="text-sm font-bold text-white">
                      {fee.amount}{" "}
                      <span className="text-white/50 font-normal">{fee.token}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* You receive estimate */}
          {estimate.amount && estimate.fees && (
            <div className="border border-[#f5a623]/30 bg-[#f5a623]/5 p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f5a623]/70">
                  Estimated received
                </p>
                <p className="mt-1 text-xs text-white/40">After all protocol fees</p>
              </div>
              <p className="text-xl font-black text-white">
                {(
                  Number(estimate.amount) -
                  estimate.fees.reduce((s, f) => s + Number(f.amount), 0)
                ).toFixed(6)}{" "}
                <span className="text-[#f5a623]">USDC</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!estimate && !error && !loading && (
        <p className="mt-8 text-sm text-white/35">
          Select chains, enter an amount, and click estimate to see gas costs and timing.
        </p>
      )}
    </main>
  );
}
