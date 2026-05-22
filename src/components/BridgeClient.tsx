"use client";

import { BridgeKit, type BridgeChainIdentifier, type BridgeResult } from "@circle-fin/bridge-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { useState } from "react";
import type { EIP1193Provider } from "viem";
import { useAccount } from "wagmi";
import { useUsdcBalances, type UsdcBalance } from "@/hooks/useUsdcBalances";
import { USDC_NETWORKS, chainLabel } from "@/lib/usdcNetworks";

const BRIDGE_CHAINS = USDC_NETWORKS.map((network) => network.bridgeId);

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

type GasFeeStep = {
  name: string;
  token: string;
  blockchain: string;
  fees: { gas: bigint | number; gasPrice: bigint | number; fee: string } | null;
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

// ── CCTP step tracking ────────────────────────────────────────────────────────
type BridgeStep = "idle" | "approve" | "burn" | "attest" | "mint" | "done";

const STEPS: Array<{ id: BridgeStep; label: string; desc: string }> = [
  { id: "approve", label: "Approve",  desc: "Allow USDC spending on source chain" },
  { id: "burn",    label: "Burn",     desc: "Lock USDC — wallet popup" },
  { id: "attest",  label: "Attest",   desc: "Circle signs the transfer (~2 min)" },
  { id: "mint",    label: "Mint",     desc: "Receive USDC on Arc" },
];

const STEP_ORDER: BridgeStep[] = ["idle", "approve", "burn", "attest", "mint", "done"];
function stepIdx(s: BridgeStep) { return STEP_ORDER.indexOf(s); }

// ── Component ─────────────────────────────────────────────────────────────────
export function BridgeClient() {
  const { address, isConnected } = useAccount();
  const { balancesByBridgeId, loading: balancesLoading, refreshing: balancesRefreshing, refetch: refetchBalances } = useUsdcBalances(address, isConnected);
  const [fromChain, setFromChain] = useState("Base_Sepolia");
  const [toChain,   setToChain]   = useState("Arc_Testnet");
  const [amount,    setAmount]    = useState("");

  const [estimate,    setEstimate]    = useState<BridgeEstimate | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [bridging,    setBridging]    = useState(false);
  const [bridgeStep,  setBridgeStep]  = useState<BridgeStep>("idle");
  const [bridgeResult, setBridgeResult] = useState<BridgeResult | null>(null);
  const [error,       setError]       = useState("");
  const fromBalance = balancesByBridgeId.get(fromChain);
  const toBalance = balancesByBridgeId.get(toChain);

  // ── helpers ────────────────────────────────────────────────────────────────
  function getRawProvider(): EIP1193Provider {
    const eth = (window as { ethereum?: EIP1193Provider }).ethereum;
    if (!eth) throw new Error(
      "No browser wallet detected. Install MetaMask (or another injected wallet) to bridge — WalletConnect alone cannot switch chains for CCTP."
    );
    return eth;
  }

  async function getBridgeParams() {
    if (!isConnected || !address) throw new Error("Connect your wallet before bridging.");
    if (!amount || Number(amount) <= 0)  throw new Error("Enter a positive USDC amount.");
    // Use window.ethereum so BridgeKit can switch chains via wallet_switchEthereumChain.
    // walletClient.transport is chain-locked to Arc Testnet and cannot sign on other chains.
    const adapter = await createViemAdapterFromProvider({ provider: getRawProvider() });
    return {
      from:   { adapter, chain: fromChain as BridgeChainIdentifier },
      to:     { adapter, chain: toChain   as BridgeChainIdentifier, useForwarder: toChain === "Arc_Testnet" },
      amount,
      token:  "USDC" as const,
    };
  }

  // ── estimate ───────────────────────────────────────────────────────────────
  async function estimateBridge() {
    setLoading(true);
    setError("");
    setEstimate(null);
    setBridgeStep("idle");
    setBridgeResult(null);
    try {
      const kit = new BridgeKit({ disableErrorReporting: true });
      const next = await kit.estimate(await getBridgeParams());
      setEstimate(next as unknown as BridgeEstimate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to estimate bridge fees");
    } finally {
      setLoading(false);
    }
  }

  // ── execute ────────────────────────────────────────────────────────────────
  async function executeBridge() {
    setBridging(true);
    setError("");
    setBridgeStep("approve");
    try {
      const kit = new BridgeKit({ disableErrorReporting: true });

      // Map BridgeKit events → step labels so the progress bar updates in real time
      kit.on("*", (payload) => {
        if (!payload || typeof payload !== "object" || !("method" in payload)) return;
        const m = String((payload as { method: unknown }).method).toLowerCase();
        if      (m.includes("approve"))                       setBridgeStep("approve");
        else if (m.includes("burn") || m.includes("deposit")) setBridgeStep("burn");
        else if (m.includes("attest") || m.includes("wait"))  setBridgeStep("attest");
        else if (m.includes("mint")  || m.includes("receive"))setBridgeStep("mint");
      });

      handleBridgeResult((await kit.bridge(await getBridgeParams())) as BridgeResult);
    } catch (err) {
      setBridgeStep("idle");
      setError(err instanceof Error ? err.message : "Bridge failed");
    } finally {
      setBridging(false);
    }
  }

  async function retryBridge() {
    if (!bridgeResult) return;
    setBridging(true);
    setError("");
    try {
      const kit = new BridgeKit({ disableErrorReporting: true });
      const adapter = await createViemAdapterFromProvider({ provider: getRawProvider() });
      handleBridgeResult(await kit.retry(bridgeResult, { from: adapter, to: adapter }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bridge retry failed");
    } finally {
      setBridging(false);
    }
  }

  function handleBridgeResult(result: BridgeResult) {
    setBridgeResult(result);
    const failedStep = result.steps.find((step) => step.state === "error");
    const pendingStep = result.steps.find((step) => step.state === "pending");
    if (result.state === "success") {
      setBridgeStep("done");
      setError("");
      return;
    }
    if (result.state === "error") {
      setBridgeStep(resultStepToUiStep(failedStep?.name));
      setError(failedStep?.errorMessage || "Bridge failed before the transfer completed. Retry the bridge step after checking your wallet.");
      return;
    }
    setBridgeStep(resultStepToUiStep(pendingStep?.name));
    setError("Bridge is still processing. Retry status after Circle confirms the remaining step.");
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      {/* Header */}
      <p className="text-sm font-black uppercase tracking-[0.28em] text-[#f5a623]">Circle CCTP</p>
      <h1 className="mt-3 font-display text-5xl font-black leading-none text-white">
        Bridge USDC<br />to Arc.
      </h1>
      <p className="mt-4 text-sm text-white/50">
        Move USDC cross-chain via Circle&apos;s native burn-and-mint protocol. No wrapping, no slippage.
      </p>

      {/* Form */}
      <div className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-white/45">From</span>
            <select
              value={fromChain}
              onChange={(e) => { setFromChain(e.target.value); setEstimate(null); setBridgeStep("idle"); setBridgeResult(null); }}
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
              onChange={(e) => { setToChain(e.target.value); setEstimate(null); setBridgeStep("idle"); setBridgeResult(null); }}
              className="mt-2 w-full bg-black border border-white/10 px-3 py-3 text-sm text-white focus:border-[#f5a623] focus:outline-none"
            >
              {BRIDGE_CHAINS.map((c) => (
                <option key={c} value={c}>{chainLabel(c)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <BalanceTile
            title="From balance"
            chain={fromChain}
            balance={fromBalance}
            loading={balancesLoading}
            connected={isConnected}
          />
          <BalanceTile
            title="To balance"
            chain={toChain}
            balance={toBalance}
            loading={balancesLoading}
            connected={isConnected}
          />
        </div>

        <label className="block">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white/45">USDC amount</span>
          <div className="relative mt-2">
            <input
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setEstimate(null); setBridgeStep("idle"); setBridgeResult(null); }}
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
        {isConnected && (
          <button
            onClick={() => refetchBalances(false)}
            disabled={balancesRefreshing}
            className="w-full border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.15em] text-white/60 transition-colors hover:border-[#f5a623] hover:text-[#f5a623] disabled:opacity-50"
          >
            {balancesRefreshing ? "Refreshing balances..." : "Refresh balances"}
          </button>
        )}
      </div>

      {/* Error / info */}
      {error && (
        <div className="mt-6 border border-[#f5a623]/30 bg-[#f5a623]/5 px-4 py-3">
          <p className="text-sm text-[#f5a623]">{error}</p>
        </div>
      )}

      {/* Estimate result */}
      {estimate && (
        <div className="mt-8 space-y-4">

          {/* Route summary */}
          <div className="border border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40 mb-4">Route</p>
            <div className="flex items-center gap-3">
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
              <div className="shrink-0 text-[#f5a623] text-lg">→</div>
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
                    <div className="shrink-0 w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-[10px] font-black text-white/50">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{step.name}</p>
                      <p className="text-xs text-white/35">{chainLabel(step.blockchain)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-white">
                        {step.fees ? Number(step.fees.fee).toFixed(6) : "0.000000"}
                      </p>
                      <p className="text-xs text-white/40">{step.token}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Protocol fees */}
          {estimate.fees && estimate.fees.length > 0 && (
            <div className="border border-white/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40 mb-4">
                Protocol fees
              </p>
              {estimate.fees.map((fee, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <span className="text-sm text-white/60 capitalize">{fee.type} fee</span>
                  <span className="text-sm font-bold text-white">
                    {fee.amount}{" "}
                    <span className="text-white/50 font-normal">{fee.token}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Estimated received */}
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

          {/* Bridge button */}
          {bridgeStep === "done" ? (
            <div className="border border-[#2d6a4f] bg-[#2d6a4f]/20 px-5 py-4 text-center">
              <p className="text-sm font-black text-white">✓ Bridge complete — USDC arrived on Arc.</p>
            </div>
          ) : (
            <button
              onClick={executeBridge}
              disabled={bridging}
              className="w-full bg-[#2d6a4f] px-5 py-4 text-sm font-black uppercase tracking-[0.15em] text-white transition-opacity disabled:opacity-60 hover:opacity-90"
            >
              {bridging ? "Bridging…" : "Bridge USDC"}
            </button>
          )}

          {bridgeResult && bridgeResult.state !== "success" && (
            <button
              onClick={retryBridge}
              disabled={bridging}
              className="w-full border border-white/15 px-5 py-3 text-sm font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-[#f5a623] hover:text-[#f5a623] disabled:opacity-60"
            >
              {bridging ? "Checking bridge..." : "Retry bridge status"}
            </button>
          )}

          {/* Step-by-step progress */}
          {bridgeStep !== "idle" && bridgeStep !== "done" && (
            <div className="border border-white/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40 mb-4">
                Bridge progress
              </p>
              <div className="space-y-3">
                {STEPS.map(({ id, label, desc }) => {
                  const done   = stepIdx(id) < stepIdx(bridgeStep);
                  const active = id === bridgeStep;
                  return (
                    <div key={id} className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition-colors ${
                        done   ? "bg-[#2d6a4f] text-white"       :
                        active ? "bg-[#f5a623] text-black"        :
                                 "border border-white/20 text-white/30"
                      }`}>
                        {done ? "✓" : active ? "…" : "○"}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold ${active ? "text-[#f5a623]" : done ? "text-white/60" : "text-white/25"}`}>
                          {label}
                        </p>
                        <p className={`text-xs ${active ? "text-white/55" : "text-white/25"}`}>{desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
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

      {/* Wallet note */}
      <p className="mt-8 text-xs text-white/20">
        CCTP bridging requires an injected wallet (MetaMask or similar) that supports chain switching. WalletConnect alone is not supported.
      </p>
    </main>
  );
}

function BalanceTile({ title, chain, balance, loading, connected }: { title: string; chain: string; balance?: UsdcBalance; loading: boolean; connected: boolean }) {
  return (
    <div className="border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">{title}</p>
      <p className="mt-1 text-xs font-bold text-white/45">{chainLabel(chain)}</p>
      <p className="mt-3 text-2xl font-black text-white">
        {!connected ? "Connect wallet" : loading ? "..." : formatBalance(balance?.balance || "0")}
        {connected && <span className="text-sm text-[#f5a623]"> USDC</span>}
      </p>
      {balance?.status === "error" && <p className="mt-2 text-xs text-red-200">Balance unavailable</p>}
    </div>
  );
}

function formatBalance(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: 6,
    minimumFractionDigits: numeric > 0 && numeric < 1 ? 2 : 0,
  });
}

function resultStepToUiStep(stepName: string | undefined): BridgeStep {
  const name = stepName?.toLowerCase() || "";
  if (name.includes("approve")) return "approve";
  if (name.includes("burn") || name.includes("deposit")) return "burn";
  if (name.includes("mint") || name.includes("receive")) return "mint";
  return "attest";
}
