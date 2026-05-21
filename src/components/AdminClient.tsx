"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";

type PendingMarket = {
  id: string;
  market_id: number;
  created_at: string;
  markets: {
    id: number;
    question: string;
    category: string;
    country: string | null;
    resolves_at: string | null;
    news_item_id: string | null;
  } | null;
};

type ResolutionState = {
  outcome: boolean;
  note: string;
  loading: boolean;
  done: boolean;
  error: string;
  txHash: string;
};

export function AdminClient() {
  const { address, isConnected } = useAccount();
  const isAdmin = address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN_WALLET?.toLowerCase();
  const [apiKey, setApiKey] = useState("");
  const [pending, setPending] = useState<PendingMarket[]>([]);
  const [fetchError, setFetchError] = useState("");
  const [fetching, setFetching] = useState(false);
  const [resolutions, setResolutions] = useState<Record<number, ResolutionState>>({});

  const fetchPending = useCallback(async () => {
    if (!apiKey.trim()) {
      setFetchError("Enter your admin API key first.");
      return;
    }
    setFetching(true);
    setFetchError("");
    try {
      const res = await fetch("/api/admin/pending-resolutions", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setPending(data.pending || []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setFetching(false);
    }
  }, [apiKey]);

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-4xl font-black text-white/10">🔒</p>
        <p className="text-lg font-black text-white/40">Connect your wallet to continue.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-4xl font-black text-white/10">⛔</p>
        <p className="text-lg font-black text-white/40">Unauthorised.</p>
        <p className="text-sm text-white/25">{address}</p>
      </div>
    );
  }

  function setResolutionField<K extends keyof ResolutionState>(marketId: number, key: K, value: ResolutionState[K]) {
    setResolutions((prev) => {
      const current: ResolutionState = prev[marketId] ?? { outcome: true, note: "", loading: false, done: false, error: "", txHash: "" };
      return { ...prev, [marketId]: { ...current, [key]: value } };
    });
  }

  async function resolveMarket(marketId: number) {
    const state = resolutions[marketId] ?? { outcome: true, note: "", loading: false, done: false, error: "", txHash: "" };
    setResolutionField(marketId, "loading", true);
    setResolutionField(marketId, "error", "");
    try {
      const res = await fetch("/api/admin/resolve-market", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ marketId, outcome: state.outcome, adminNote: state.note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Resolution failed");
      setResolutionField(marketId, "done", true);
      setResolutionField(marketId, "txHash", data.txHash || "");
      setPending((prev) => prev.filter((p) => p.market_id !== marketId));
    } catch (err) {
      setResolutionField(marketId, "error", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setResolutionField(marketId, "loading", false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 font-display text-3xl font-black text-[#f5a623]">Admin — Manual Resolutions</h1>
      <p className="mb-8 text-sm text-white/50">
        Markets that could not be auto-resolved (non-FOREX/SPORTS, or API failures) appear here.
      </p>

      <div className="mb-6 flex gap-3">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchPending()}
          placeholder="Admin API key"
          className="flex-1 border border-white/15 bg-black px-4 py-3 text-sm text-white outline-none focus:border-[#f5a623]"
        />
        <button
          onClick={fetchPending}
          disabled={fetching}
          className="bg-[#f5a623] px-6 py-3 text-sm font-black text-black disabled:opacity-50"
        >
          {fetching ? "Loading..." : "Load queue"}
        </button>
      </div>

      {fetchError && <p className="mb-6 text-sm text-red-300">{fetchError}</p>}

      {pending.length === 0 && !fetchError && !fetching && (
        <p className="text-sm text-white/40">
          {apiKey ? "No pending markets — queue is empty." : "Enter your admin key and click Load queue."}
        </p>
      )}

      <div className="space-y-4">
        {pending.map((item) => {
          const market = item.markets;
          if (!market) return null;
          const state = resolutions[market.id] ?? { outcome: true, note: "", loading: false, done: false, error: "", txHash: "" };
          const resolvesAt = market.resolves_at ? new Date(market.resolves_at).toLocaleString() : "—";

          return (
            <div key={item.id} className="border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/70">
                  #{market.id}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/70">
                  {market.category}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/70">
                  {market.country ?? "—"}
                </span>
                <span className="ml-auto text-xs text-white/40">Resolves: {resolvesAt}</span>
              </div>

              <p className="mb-4 font-semibold text-white">{market.question}</p>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setResolutionField(market.id, "outcome", true)}
                  className={`py-3 text-sm font-black ${state.outcome ? "bg-[#2d6a4f] text-white" : "bg-white/10 text-white/60"}`}
                >
                  YES — Outcome true
                </button>
                <button
                  onClick={() => setResolutionField(market.id, "outcome", false)}
                  className={`py-3 text-sm font-black ${!state.outcome ? "bg-[#d1495b] text-white" : "bg-white/10 text-white/60"}`}
                >
                  NO — Outcome false
                </button>
              </div>

              <input
                value={state.note}
                onChange={(e) => setResolutionField(market.id, "note", e.target.value)}
                placeholder="Admin note / resolution evidence (optional)"
                className="mb-3 w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-[#f5a623]"
              />

              <button
                onClick={() => resolveMarket(market.id)}
                disabled={state.loading || state.done}
                className="w-full bg-[#f5a623] py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state.loading ? "Resolving on-chain..." : state.done ? "Resolved" : `Resolve #${market.id} as ${state.outcome ? "YES" : "NO"}`}
              </button>

              {state.txHash && (
                <p className="mt-2 text-xs text-[#f5a623]">Tx: {state.txHash}</p>
              )}
              {state.error && (
                <p className="mt-2 text-sm text-red-300">{state.error}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
