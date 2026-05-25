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

function useChainData(): { data: ChainData | null; loading: boolean } {
  const [data, setData] = useState<ChainData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/yield/chain")
      .then((r) => r.json())
      .then((json: ChainData & { error?: string }) => {
        if (!json.error) setData(json);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

export function YieldChainMetrics() {
  const { data, loading } = useChainData();

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
        value={
          data != null
            ? `$${fmt(data.perMarket.reduce((s, m) => s + m.investedPrincipal, 0))}`
            : null
        }
        loading={loading}
      />
      <ChainMetric
        label="Recorded yield"
        value={
          data != null
            ? `$${fmt(data.perMarket.reduce((s, m) => s + m.yieldEarned, 0))}`
            : null
        }
        loading={loading}
      />
    </>
  );
}

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

  return (
    <div className="border border-white/10 p-5">
      <h2 className="font-display text-2xl font-black text-[#f5a623]">Agent automation</h2>
      <p className="mt-3 text-sm leading-relaxed text-white/60">
        The GitHub cron calls the agent USYC sweep every 15 minutes. The agent checks open markets,
        skips resolved or empty pools, and invests eligible idle USDC above the configured threshold.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="border border-white/10 p-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Min idle</p>
          <p className="mt-1 font-black text-white">${minIdleUsdc}</p>
        </div>
        <div className="border border-white/10 p-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Sweep cadence</p>
          <p className="mt-1 font-black text-white">15 min</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div className="border border-white/10 p-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Total pool</p>
          <p className="mt-1 font-black text-white">${fmt(totalPoolUsdc)}</p>
        </div>
        <div className="border border-white/10 p-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
            Invest cap ({maxInvestedBps / 100}%)
          </p>
          <p className="mt-1 font-black text-white">${fmt(investCapacityUsdc)}</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div className="border border-white/10 p-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">In USYC now</p>
          {loading ? (
            <div className="mt-1 h-6 w-16 animate-pulse rounded bg-white/10" />
          ) : (
            <p className="mt-1 font-black text-white">${fmt(currentInvestedUsdc)}</p>
          )}
        </div>
        <div className="border border-white/10 p-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Remaining cap</p>
          {loading ? (
            <div className="mt-1 h-6 w-16 animate-pulse rounded bg-white/10" />
          ) : (
            <p className="mt-1 font-black text-white">
              ${fmt(Math.max(0, investCapacityUsdc - currentInvestedUsdc))}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

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
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : activity.length === 0 ? (
        <p className="mt-3 text-sm text-white/55">
          {totalPoolUsdc === 0
            ? `No bets placed yet — all market pools are empty. The sweep needs at least $${minIdleUsdc} idle USDC per market before it can invest.`
            : `Eligible idle exists but no on-chain transactions yet. Check that APP_URL and CRON_SECRET are set as GitHub Actions secrets so the sweep can reach this app.`}
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
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-white/10" />
      ) : (
        <div className="mt-2 text-2xl font-black text-white">{value ?? "—"}</div>
      )}
    </div>
  );
}

function fmt(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
