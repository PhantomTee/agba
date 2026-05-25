import { Contract, formatUnits } from "ethers";
import type { Metadata } from "next";
import { getArcProvider, getReadOnlyMarketContract, getReadOnlyUsdcContract } from "@/lib/chain";
import { ERC20_ABI } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "USYC Yield Operations",
  description: "Idle USDC and USYC yield operations for Agba market pools.",
};

export const revalidate = 60;

type YieldMarket = {
  id: number;
  question: string;
  category: string;
  pool: number;
  investedPrincipal: number;
  usycShares: number;
  yieldEarned: number;
  resolved: boolean;
  eligibleIdle: number;
};

type YieldActivity = {
  marketId: number;
  usdcAmount: number;
  txHash: string;
  status: "confirmed";
};

type YieldState = {
  contractUsdc: number;
  contractUsyc: number;
  minIdleUsdc: string;
  totalEligibleIdle: number;
  eligibleIdleReady: boolean;
  totalYieldEarned: number;
  markets: YieldMarket[];
  activity: YieldActivity[];
  asOf: string;
  marketsLoaded: number;
  marketsExpected: number;
  eligibleMarkets: number;
  totalPoolUsdc: number;
  investCapacityUsdc: number;
  currentInvestedUsdc: number;
  error: boolean;
};

export default async function YieldPage() {
  const state = await fetchYieldState();

  if (state.error) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="border border-red-500/30 bg-red-500/10 p-6">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-red-300">Yield unavailable</p>
          <h1 className="mt-2 font-display text-4xl font-black text-white">USYC Yield</h1>
          <p className="mt-4 text-sm leading-relaxed text-white/75">
            The yield dashboard could not load right now because required configuration or backend services are unavailable.
            This is temporary once environment variables and upstream services are healthy.
          </p>
        </div>
      </main>
    );
  }

  const eligibleMarkets = state.markets.filter((market) => market.eligibleIdle > 0);
  const otherMarkets = state.markets.filter((market) => market.eligibleIdle <= 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="border-b border-white/10 pb-7">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f5a623]">Treasury operations</p>
        <h1 className="mt-2 font-display text-5xl font-black leading-none text-white md:text-7xl">USYC Yield</h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/55">
          This page tracks USDC locked in open prediction markets and the portion the AI agent can move into USYC while the market waits for resolution.
          The agent invests market-scoped idle USDC automatically, and resolution redeems USYC before winner payouts.
        </p>
        <p className="mt-3 text-xs text-white/45">
          As of {new Date(state.asOf).toLocaleString()} · Loaded {state.marketsLoaded}/{state.marketsExpected} markets · Eligible now: {state.eligibleMarkets}
        </p>
      </div>

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <Metric label="Contract USDC" value={`$${fmt(state.contractUsdc)}`} />
        <Metric label="Contract USYC" value={fmt(state.contractUsyc)} />
        <Metric
          label="Eligible idle USDC"
          value={state.eligibleIdleReady ? `$${fmt(state.totalEligibleIdle)}` : "Calculating..."}
        />
        <Metric label="Recorded yield" value={`$${fmt(state.totalYieldEarned)}`} />
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <h2 className="font-display text-3xl font-black text-white">Eligible Now</h2>
          <div className="mt-4 border-t border-white/10">
            {eligibleMarkets.length === 0 ? <p className="py-8 text-white/45">No markets currently above idle threshold.</p> : null}
            {eligibleMarkets.map((market) => (
              <article key={market.id} className="grid gap-4 border-b border-white/10 py-5 md:grid-cols-[minmax(0,1fr)_180px]">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs font-black text-black bg-[#f5a623]">#{market.id}</span>
                    <span className="px-2 py-1 text-xs font-bold text-white/50">{market.category}</span>
                    {market.usycShares > 0 && <span className="px-2 py-1 text-xs font-black text-white bg-[#2d6a4f]">USYC active</span>}
                  </div>
                  <p className="font-bold text-white">{market.question}</p>
                </div>
                <div className="text-sm text-white/55 md:text-right">
                  <p>Pool: ${fmt(market.pool)}</p>
                  <p>Invested: ${fmt(market.investedPrincipal)}</p>
                  <p>Idle: ${fmt(market.eligibleIdle)}</p>
                </div>
              </article>
            ))}
          </div>

          <h3 className="mt-8 text-sm font-black uppercase tracking-[0.2em] text-white/45">Other open markets</h3>
          <div className="mt-3 border-t border-white/10">
            {otherMarkets.length === 0 ? <p className="py-6 text-white/45">No additional open markets.</p> : null}
            {otherMarkets.map((market) => (
              <article key={market.id} className="grid gap-4 border-b border-white/10 py-4 md:grid-cols-[minmax(0,1fr)_180px]">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs font-black text-black bg-white/20">#{market.id}</span>
                    <span className="px-2 py-1 text-xs font-bold text-white/50">{market.category}</span>
                  </div>
                  <p className="text-sm font-bold text-white/80">{market.question}</p>
                </div>
                <div className="text-xs text-white/50 md:text-right">
                  <p>Pool: ${fmt(market.pool)}</p>
                  <p>Idle: ${fmt(market.eligibleIdle)}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="border border-white/10 p-5">
            <h2 className="font-display text-2xl font-black text-[#f5a623]">Agent automation</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              The GitHub cron calls the agent USYC sweep every 15 minutes. The agent checks open markets, skips resolved or empty pools, and invests eligible idle USDC above the configured threshold.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="border border-white/10 p-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Min idle</p>
                <p className="mt-1 font-black text-white">${state.minIdleUsdc}</p>
              </div>
              <div className="border border-white/10 p-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Sweep cadence</p>
                <p className="mt-1 font-black text-white">15 min</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="border border-white/10 p-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Total pool</p>
                <p className="mt-1 font-black text-white">${fmt(state.totalPoolUsdc)}</p>
              </div>
              <div className="border border-white/10 p-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Invest cap (70%)</p>
                <p className="mt-1 font-black text-white">${fmt(state.investCapacityUsdc)}</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="border border-white/10 p-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">In USYC now</p>
                <p className="mt-1 font-black text-white">${fmt(state.currentInvestedUsdc)}</p>
              </div>
              <div className="border border-white/10 p-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Remaining cap</p>
                <p className="mt-1 font-black text-white">${fmt(Math.max(0, state.investCapacityUsdc - state.currentInvestedUsdc))}</p>
              </div>
            </div>
          </div>
          <div className="border border-white/10 p-5">
            <h2 className="font-display text-2xl font-black text-[#f5a623]">Recent USYC deposits</h2>
            {state.activity.length === 0 ? (
              <p className="mt-3 text-sm text-white/55">
                {state.totalPoolUsdc === 0
                  ? "No bets placed yet — all market pools are empty. The sweep needs at least $" + state.minIdleUsdc + " idle USDC per market before it can invest."
                  : state.totalEligibleIdle < Number(state.minIdleUsdc)
                  ? "All idle USDC ($" + fmt(state.totalEligibleIdle) + ") is below the $" + state.minIdleUsdc + " per-market minimum. Place more bets or lower AGENT_USYC_MIN_IDLE_USDC."
                  : "Eligible idle exists but no deposits confirmed yet. Check that APP_URL and CRON_SECRET are set as GitHub Actions secrets so the sweep can reach this app."}
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {state.activity.map((item) => (
                  <div key={`${item.txHash}-${item.marketId}`} className="border border-white/10 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Market #{item.marketId}</p>
                    <p className="mt-1 text-sm font-bold text-white">{fmt(item.usdcAmount)} USDC invested</p>
                    <p className="mt-1 text-xs text-[#2d6a4f]">Status: {item.status}</p>
                    <p className="mt-1 break-all text-xs text-white/45">Tx: {item.txHash}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-white/10 p-5">
            <h2 className="font-display text-2xl font-black text-[#f5a623]">Integration model</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              USYC is a tokenized money market fund. Circle documents USYC subscription and redemption through USDC, automatic yield through a rising token price,
              and eligibility restrictions. The safe Agba model is market-scoped: invest only locked pool USDC, redeem during resolution, then distribute yield to winners.
            </p>
          </div>
          <div className="border border-white/10 p-5">
            <h2 className="font-display text-2xl font-black text-[#f5a623]">Guardrails</h2>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li>Only market-locked USDC is eligible.</li>
              <li>Each market is tracked by principal, so later bets can be swept separately.</li>
              <li>Resolved markets are skipped.</li>
              <li>Resolution redeems a market&apos;s USYC before winners claim.</li>
            </ul>
          </div>
          <div className="border border-white/10 p-5 text-sm text-white/50">
            <a href="https://developers.circle.com/tokenized/usyc/overview" target="_blank" rel="noreferrer" className="font-bold text-[#f5a623] hover:underline">
              Circle USYC docs
            </a>
            <p className="mt-2">Review eligibility, settlement, redemption, and operational constraints before enabling automated investment.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

async function fetchYieldState(): Promise<YieldState> {
  const baseState: YieldState = {
    contractUsdc: 0,
    contractUsyc: 0,
    minIdleUsdc: process.env.AGENT_USYC_MIN_IDLE_USDC || "1",
    totalEligibleIdle: 0,
    eligibleIdleReady: false,
    totalYieldEarned: 0,
    markets: [],
    activity: [],
    asOf: new Date().toISOString(),
    marketsLoaded: 0,
    marketsExpected: 0,
    eligibleMarkets: 0,
    totalPoolUsdc: 0,
    investCapacityUsdc: 0,
    currentInvestedUsdc: 0,
    error: false,
  };

  let usycAddress = "";
  let contractAddress = "";
  try {
    usycAddress = getEnv("NEXT_PUBLIC_USYC_ADDRESS");
    contractAddress = getEnv("NEXT_PUBLIC_CONTRACT_ADDRESS");
  } catch {
    return { ...baseState, eligibleIdleReady: false, error: true };
  }

  try {
    const supabase = getSupabaseAdmin();
    const contract = getReadOnlyMarketContract();
    const provider = getArcProvider();
    const usdc = getReadOnlyUsdcContract();
    const usyc = new Contract(usycAddress, ERC20_ABI, provider);
    let depositLogs: Array<{ args?: { marketId?: bigint; usdcAmount?: bigint }; transactionHash: string }> = [];
    try {
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 1200);
      depositLogs = (await contract.queryFilter(contract.filters.MarketUSYCInvested(), fromBlock, latestBlock)) as typeof depositLogs;
    } catch {
      depositLogs = [];
    }
    const [{ data: dbMarkets }, marketCount, contractUsdcRaw, contractUsycRaw] = await Promise.all([
      supabase.from("markets").select("id,question,category,yes_pool,no_pool").eq("resolved", false).order("created_at", { ascending: false }).limit(100),
      contract.marketCount().then((count: bigint) => Number(count)),
      usdc.balanceOf(contractAddress),
      usyc.balanceOf(contractAddress),
    ]);

    const rows = (dbMarkets || []).filter((market) => Number(market.id) <= marketCount);
    const markets = await Promise.all(
      rows.map(async (market) => {
        const dbPool = Number(market.yes_pool || 0) + Number(market.no_pool || 0);
        try {
          const [onchain, usycSharesRaw, yieldRaw, principalRaw] = await Promise.all([
            contract.getMarket(Number(market.id)),
            contract.getMarketUSYCBalance(Number(market.id)),
            contract.getMarketYieldEarned(Number(market.id)),
            contract.marketUsycPrincipal(Number(market.id)).catch(() => BigInt(0)),
          ]);
          if (Number(onchain.id) === 0 || onchain.resolved) return null;
          const pool = Number(formatUnits(onchain.yesPool + onchain.noPool, 6));
          const investedPrincipal = Number(formatUnits(principalRaw, 6));
          return {
            id: Number(onchain.id),
            question: onchain.question || market.question,
            category: onchain.category || market.category,
            pool,
            investedPrincipal,
            usycShares: Number(formatUnits(usycSharesRaw, 6)),
            yieldEarned: Number(formatUnits(yieldRaw, 6)),
            resolved: false,
            eligibleIdle: Math.max(0, pool - investedPrincipal),
          };
        } catch {
          // On-chain call failed: fall back to Supabase pool so the total stays stable across refreshes
          return {
            id: Number(market.id),
            question: market.question,
            category: market.category,
            pool: dbPool,
            investedPrincipal: 0,
            usycShares: 0,
            yieldEarned: 0,
            resolved: false,
            eligibleIdle: dbPool,
          };
        }
      }),
    );

    const currentMarkets = markets.filter((market): market is YieldMarket => market !== null);
    const activity = depositLogs
      .slice(-10)
      .reverse()
      .map((log) => ({
        marketId: Number(log.args?.marketId || 0),
        usdcAmount: Number(formatUnits(log.args?.usdcAmount || BigInt(0), 6)),
        txHash: log.transactionHash,
        status: "confirmed" as const,
      }))
      .filter((item) => item.marketId > 0);

    const totalPoolUsdc = currentMarkets.reduce((sum, m) => sum + m.pool, 0);
    const maxInvestedBps = Math.min(9000, Math.max(1000, Number(process.env.AGENT_USYC_MAX_INVESTED_BPS || "7000")));
    const investCapacityUsdc = (totalPoolUsdc * maxInvestedBps) / 10_000;
    const currentInvestedUsdc = currentMarkets.reduce((sum, m) => sum + m.investedPrincipal, 0);

    return {
      ...baseState,
      contractUsdc: Number(formatUnits(contractUsdcRaw, 6)),
      contractUsyc: Number(formatUnits(contractUsycRaw, 6)),
      totalEligibleIdle: currentMarkets.reduce((sum, market) => sum + market.eligibleIdle, 0),
      eligibleIdleReady: true,
      totalYieldEarned: currentMarkets.reduce((sum, market) => sum + market.yieldEarned, 0),
      markets: currentMarkets,
      activity,
      asOf: new Date().toISOString(),
      marketsLoaded: currentMarkets.length,
      marketsExpected: rows.length,
      eligibleMarkets: currentMarkets.filter((market) => market.eligibleIdle > 0).length,
      totalPoolUsdc,
      investCapacityUsdc,
      currentInvestedUsdc,
    };
  } catch {
    return { ...baseState, eligibleIdleReady: false, error: true };
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 p-4">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function fmt(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
