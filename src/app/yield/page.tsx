import type { Metadata } from "next";
import { formatUnits } from "ethers";
import { YieldChainMetrics, YieldAgentCard, YieldActivityPanel } from "@/components/YieldChainPanel";
import { getReadOnlyMarketContract } from "@/lib/chain";
import { getSupabaseAdmin } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "USYC Yield Operations",
  description: "Idle USDC and USYC yield operations for Agba market pools.",
};

export const dynamic = "force-dynamic";

type YieldMarket = {
  id: number;
  question: string;
  category: string;
  pool: number;
};

type YieldState = {
  minIdleUsdc: string;
  maxInvestedBps: number;
  totalPoolUsdc: number;
  eligibleCount: number;
  markets: YieldMarket[];
  asOf: string;
};

export default async function YieldPage() {
  const state = await fetchYieldState();
  const minIdle = Number(state.minIdleUsdc);
  const eligibleMarkets = state.markets.filter((m) => m.pool >= minIdle);
  const otherMarkets = state.markets.filter((m) => m.pool < minIdle);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="border-b border-white/10 pb-7">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f5a623]">Treasury operations</p>
        <h1 className="mt-2 font-display text-5xl font-black leading-none text-white md:text-7xl">USYC Yield</h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/55">
          This page tracks USDC locked in open prediction markets and the portion the AI agent can move into USYC while
          the market waits for resolution. The agent invests market-scoped idle USDC automatically, and resolution
          redeems USYC before winner payouts.
        </p>
        <p className="mt-3 text-xs text-white/45">
          As of {new Date(state.asOf).toLocaleString()} · {state.markets.length} open markets · $
          {fmt(state.totalPoolUsdc)} total pool · {state.eligibleCount} eligible now
        </p>
      </div>

      {/* Top metrics — chain data loaded async by client component */}
      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <YieldChainMetrics />
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <h2 className="font-display text-3xl font-black text-white">Eligible Now</h2>
          <div className="mt-4 border-t border-white/10">
            {eligibleMarkets.length === 0 ? (
              <p className="py-8 text-white/45">No markets currently above idle threshold.</p>
            ) : null}
            {eligibleMarkets.map((market) => (
              <article
                key={market.id}
                className="grid gap-4 border-b border-white/10 py-5 md:grid-cols-[minmax(0,1fr)_180px]"
              >
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="bg-[#f5a623] px-2 py-1 text-xs font-black text-black">#{market.id}</span>
                    <span className="px-2 py-1 text-xs font-bold text-white/50">{market.category}</span>
                  </div>
                  <p className="font-bold text-white">{market.question}</p>
                </div>
                <div className="text-sm text-white/55 md:text-right">
                  <p>Pool: ${fmt(market.pool)}</p>
                </div>
              </article>
            ))}
          </div>

          <h3 className="mt-8 text-sm font-black uppercase tracking-[0.2em] text-white/45">Other open markets</h3>
          <div className="mt-3 border-t border-white/10">
            {otherMarkets.length === 0 ? (
              <p className="py-6 text-white/45">No additional open markets.</p>
            ) : null}
            {otherMarkets.map((market) => (
              <article
                key={market.id}
                className="grid gap-4 border-b border-white/10 py-4 md:grid-cols-[minmax(0,1fr)_180px]"
              >
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="bg-white/20 px-2 py-1 text-xs font-black">#{market.id}</span>
                    <span className="px-2 py-1 text-xs font-bold text-white/50">{market.category}</span>
                  </div>
                  <p className="text-sm font-bold text-white/80">{market.question}</p>
                </div>
                <div className="text-xs text-white/50 md:text-right">
                  <p>Pool: ${fmt(market.pool)}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <YieldAgentCard
            totalPoolUsdc={state.totalPoolUsdc}
            minIdleUsdc={state.minIdleUsdc}
            maxInvestedBps={state.maxInvestedBps}
          />
          <YieldActivityPanel totalPoolUsdc={state.totalPoolUsdc} minIdleUsdc={state.minIdleUsdc} />
          <div className="border border-white/10 p-5">
            <h2 className="font-display text-2xl font-black text-[#f5a623]">Integration model</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              USYC is a tokenized money market fund. Circle documents USYC subscription and redemption through USDC,
              automatic yield through a rising token price, and eligibility restrictions. The safe Agba model is
              market-scoped: invest only locked pool USDC, redeem during resolution, then distribute yield to winners.
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
            <a
              href="https://developers.circle.com/tokenized/usyc/overview"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-[#f5a623] hover:underline"
            >
              Circle USYC docs
            </a>
            <p className="mt-2">
              Review eligibility, settlement, redemption, and operational constraints before enabling automated
              investment.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}

async function fetchYieldState(): Promise<YieldState> {
  const minIdleUsdc = process.env.AGENT_USYC_MIN_IDLE_USDC || "1";
  const maxInvestedBps = Math.min(
    9000,
    Math.max(1000, Number(process.env.AGENT_USYC_MAX_INVESTED_BPS || "7000"))
  );

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("markets")
      .select("id,question,category,yes_pool,no_pool")
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const dbMarkets: YieldMarket[] = (data || []).map((m) => ({
      id: Number(m.id),
      question: String(m.question),
      category: String(m.category),
      pool: Number(m.yes_pool || 0) + Number(m.no_pool || 0),
    }));

    // Enrich pools from chain — Supabase yes_pool/no_pool can lag behind on-chain bets
    const contract = getReadOnlyMarketContract();
    const markets = await Promise.all(
      dbMarkets.map(async (m) => {
        try {
          const onchain = await contract.getMarket(m.id);
          const pool = Number(formatUnits(BigInt(onchain.yesPool ?? 0), 6)) +
                       Number(formatUnits(BigInt(onchain.noPool ?? 0), 6));
          return { ...m, pool };
        } catch {
          return m;
        }
      })
    );

    const totalPoolUsdc = markets.reduce((sum, m) => sum + m.pool, 0);
    const minIdle = Number(minIdleUsdc);

    return {
      minIdleUsdc,
      maxInvestedBps,
      totalPoolUsdc,
      eligibleCount: markets.filter((m) => m.pool >= minIdle).length,
      markets,
      asOf: new Date().toISOString(),
    };
  } catch {
    return {
      minIdleUsdc,
      maxInvestedBps,
      totalPoolUsdc: 0,
      eligibleCount: 0,
      markets: [],
      asOf: new Date().toISOString(),
    };
  }
}

function fmt(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
