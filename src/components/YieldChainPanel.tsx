"use client";

import { useEffect, useState } from "react";

type ActivityItem = {
  type: "invested" | "redeemed";
  marketId: number;
  question: string;
  usdcAmount: number;
  usycShares: number;
  yieldEarned: number;
  txHash: string;
  blockNumber: number;
};

type ChainData = {
  contractUsdc: number;
  contractUsyc: number;
  perMarket: Array<{
    id: number;
    investedPrincipal: number;
    usycShares: number;
    yieldEarned: number;
  }>;
  activity: ActivityItem[];
};

// Single in-flight request shared across all component instances on the page.
// Prevents three separate fetches when YieldChainMetrics, YieldAgentCard, and
// YieldActivityPanel all mount at the same time.
let _inflight: Promise<ChainData> | null = null;
let _cache: ChainData | null = null;

function loadChainData(): Promise<ChainData> {
  if (_inflight) return _inflight;
  _inflight = fetch("/api/yield/chain")
    .then((r) => r.json() as Promise<ChainData & { error?: string }>)
    .then((json) => {
      _inflight = null;
      if (!json.error) _cache = json;
      return json as ChainData;
    })
    .catch(() => {
      _inflight = null;
      return { contractUsdc: 0, contractUsyc: 0, perMarket: [], activity: [] };
    });
  return _inflight;
}

function useChainData(): { data: ChainData | null; loading: boolean } {
  const [data, setData] = useState<ChainData | null>(_cache);
  const [loading, setLoading] = useState(_cache === null);

  useEffect(() => {
    if (_cache) {
      setData(_cache);
      setLoading(false);
      return;
    }
    loadChainData()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

// ─── Top-row metric cards ────────────────────────────────────────────────────

export function YieldChainMetrics() {
  const { data, loading } = useChainData();

  const currentInvestedUsdc =
    data?.perMarket.reduce((s, m) => s + m.investedPrincipal, 0) ?? 0;
  const totalYieldEarned =
    data?.perMarket.reduce((s, m) => s + m.yieldEarned, 0) ?? 0;

  return (
    <>
      <ChainMetric
        label="Contract USDC"
        value={data != null ? `$${fmt(data.contractUsdc)}` : null}
        loading={loading}
      />
      <ChainMetric
        label="Contract USYC"
        value={data != null ? fmt(data.contractUsyc) : null}
        loading={loading}
      />
      <ChainMetric
        label="In USYC now"
        value={data != null ? `$${fmt(currentInvestedUsdc)}` : null}
        loading={loading}
      />
      <ChainMetric
        label="Recorded yield"
        value={data != null ? `$${fmt(totalYieldEarned)}` : null}
        loading={loading}
      />
    </>
  );
}

// ─── Agent automation sidebar card ──────────────────────────────────────────

export function YieldAgentCard({
  totalPoolUsdc,
  minIdleUsdc,
  maxInvestedBps,
}: {
  totalPoolUsdc: number;
  minIdleUsdc: string;
  maxInvestedBps: number;
}) {
  const { data, loading } = useChainData();

  const investCapacityUsdc = (totalPoolUsdc * maxInvestedBps) / 10_000;
  const currentInvestedUsdc =
    data?.perMarket.reduce((s, m) => s + m.investedPrincipal, 0) ?? 0;
  const remainingCap = Math.max(0, investCapacityUsdc - currentInvestedUsdc);

  return (
    <div className="border border-white/10 p-5">
      <h2 className="font-display text-2xl font-black text-[#f5a623]">Agent automation</h2>
      {loading ? (
        <AgentCardSkeleton />
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <StatCell label="Min idle" value={`$${minIdleUsdc}`} />
            <StatCell label="Sweep cadence" value="15 min" />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <StatCell label="Total pool" value={`$${fmt(totalPoolUsdc)}`} />
            <StatCell label={`Invest cap (${maxInvestedBps / 100}%)`} value={`$${fmt(investCapacityUsdc)}`} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <StatCell label="In USYC now" value={`$${fmt(currentInvestedUsdc)}`} highlight={currentInvestedUsdc > 0} />
            <StatCell label="Remaining cap" value={`$${fmt(remainingCap)}`} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── USYC Activity sidebar card ──────────────────────────────────────────────

export function YieldActivityPanel({
  totalPoolUsdc,
  minIdleUsdc,
}: {
  totalPoolUsdc: number;
  minIdleUsdc: string;
}) {
  const { data, loading } = useChainData();
  const activity = data?.activity ?? [];

  return (
    <div className="border border-white/10 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-black text-[#f5a623]">USYC Activity</h2>
        {!loading && activity.length > 0 && (
          <span className="text-xs font-bold text-white/35">
            {activity.length} event{activity.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <ActivitySkeleton />
      ) : activity.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          No yield activity yet — the sweep will invest once markets accumulate at least ${minIdleUsdc} USDC.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {activity.map((item) => (
            <div key={`${item.txHash}-${item.blockNumber}`} className="border border-white/10 p-3">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 text-xs font-black ${
                    item.type === "invested" ? "bg-[#f5a623] text-black" : "bg-[#2d6a4f] text-white"
                  }`}
                >
                  {item.type === "invested" ? "INVESTED" : "REDEEMED"}
                </span>
                <span className="text-xs font-bold text-white/40">Market #{item.marketId}</span>
                <span className="text-xs text-white/25">block {item.blockNumber}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs font-bold leading-snug text-white">
                {item.question}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
                {item.type === "invested" ? (
                  <>
                    <span>${fmt(item.usdcAmount)} USDC → USYC</span>
                    {item.usycShares > 0 && <span>{fmt(item.usycShares)} USYC shares</span>}
                  </>
                ) : (
                  <>
                    <span>${fmt(item.usdcAmount)} USDC received</span>
                    {item.yieldEarned > 0 && (
                      <span className="text-[#2d6a4f]">+${fmt(item.yieldEarned)} yield</span>
                    )}
                  </>
                )}
              </div>
              <p className="mt-2 break-all font-mono text-xs text-white/30">
                {item.txHash.slice(0, 10)}…{item.txHash.slice(-8)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton sub-components ─────────────────────────────────────────────────

function AgentCardSkeleton() {
  return (
    <div className="mt-4 space-y-2 animate-pulse">
      <div className="grid grid-cols-2 gap-2">
        <SkeletonCell />
        <SkeletonCell />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SkeletonCell />
        <SkeletonCell />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SkeletonCell />
        <SkeletonCell />
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="mt-3 space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2 border border-white/5 p-3">
          <div className="flex gap-2">
            <div className="h-5 w-20 rounded bg-white/10" />
            <div className="h-5 w-16 rounded bg-white/5" />
          </div>
          <div className="h-4 w-full rounded bg-white/8" />
          <div className="h-4 w-3/4 rounded bg-white/8" />
          <div className="h-3 w-1/2 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

function SkeletonCell() {
  return (
    <div className="border border-white/10 p-3">
      <div className="h-3 w-16 rounded bg-white/10" />
      <div className="mt-2 h-6 w-20 rounded bg-white/15" />
    </div>
  );
}

// ─── Shared primitives ───────────────────────────────────────────────────────

function ChainMetric({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | null;
  loading: boolean;
}) {
  return (
    <div className="border border-white/10 p-4">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">{label}</div>
      {loading ? (
        <div className="mt-2 space-y-1.5 animate-pulse">
          <div className="h-8 w-24 rounded bg-white/10" />
        </div>
      ) : (
        <div className="mt-2 text-2xl font-black text-white">{value ?? "—"}</div>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="border border-white/10 p-3">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className={`mt-1 font-black ${highlight ? "text-[#2d9d57]" : "text-white"}`}>{value}</p>
    </div>
  );
}

function fmt(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
