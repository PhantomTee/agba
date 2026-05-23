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

export const dynamic = "force-dynamic";

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

export default async function YieldPage() {
  const state = await fetchYieldState();

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="border-b border-white/10 pb-7">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f5a623]">Treasury operations</p>
        <h1 className="mt-2 font-display text-5xl font-black leading-none text-white md:text-7xl">USYC Yield</h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/55">
          This page tracks USDC locked in open prediction markets and the portion that can be moved into USYC while the market waits for resolution.
          USYC redemptions should happen before payout, so investment actions must remain owner/admin controlled.
        </p>
      </div>

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <Metric label="Contract USDC" value={`$${fmt(state.contractUsdc)}`} />
        <Metric label="Contract USYC" value={fmt(state.contractUsyc)} />
        <Metric label="Eligible idle USDC" value={`$${fmt(state.totalEligibleIdle)}`} />
        <Metric label="Recorded yield" value={`$${fmt(state.totalYieldEarned)}`} />
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <h2 className="font-display text-3xl font-black text-white">Open Market Pools</h2>
          <div className="mt-4 border-t border-white/10">
            {state.markets.length === 0 ? <p className="py-8 text-white/45">No open markets with USDC pools yet.</p> : null}
            {state.markets.map((market) => (
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
        </div>

        <aside className="space-y-4">
          <div className="border border-white/10 p-5">
            <h2 className="font-display text-2xl font-black text-[#f5a623]">Integration model</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              USYC is a tokenized money market fund. Circle documents USYC subscription and redemption through USDC, automatic yield through a rising token price,
              and eligibility restrictions. The safe Agba model is market-scoped: invest only locked pool USDC, redeem during resolution, then distribute yield to winners.
            </p>
          </div>
          <div className="border border-white/10 p-5">
            <h2 className="font-display text-2xl font-black text-[#f5a623]">Controls to add next</h2>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li>Admin action to invest a selected market&apos;s idle USDC.</li>
              <li>Minimum idle threshold and reserve ratio per market.</li>
              <li>Resolution guard that redeems USYC before claims open.</li>
              <li>Audit log for every invest/redeem transaction.</li>
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

async function fetchYieldState() {
  const supabase = getSupabaseAdmin();
  const contract = getReadOnlyMarketContract();
  const provider = getArcProvider();
  const usdc = getReadOnlyUsdcContract();
  const usyc = new Contract(getEnv("NEXT_PUBLIC_USYC_ADDRESS"), ERC20_ABI, provider);
  const contractAddress = getEnv("NEXT_PUBLIC_CONTRACT_ADDRESS");
  const [{ data: dbMarkets }, marketCount, contractUsdcRaw, contractUsycRaw] = await Promise.all([
    supabase.from("markets").select("id,question,category").eq("resolved", false).order("created_at", { ascending: false }).limit(100),
    contract.marketCount().then((count: bigint) => Number(count)),
    usdc.balanceOf(contractAddress),
    usyc.balanceOf(contractAddress),
  ]);

  const rows = (dbMarkets || []).filter((market) => Number(market.id) <= marketCount);
  const markets = await Promise.all(
    rows.map(async (market) => {
      const [onchain, usycSharesRaw, yieldRaw, principalRaw] = await Promise.all([
        contract.getMarket(Number(market.id)),
        contract.getMarketUSYCBalance(Number(market.id)),
        contract.getMarketYieldEarned(Number(market.id)),
        contract.marketUsycPrincipal(Number(market.id)).catch(() => BigInt(0)),
      ]);
      if (Number(onchain.id) === 0) return null;
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
        resolved: onchain.resolved,
        eligibleIdle: onchain.resolved ? 0 : Math.max(0, pool - investedPrincipal),
      };
    }),
  );
  const currentMarkets = markets.filter((market): market is YieldMarket => market !== null);

  return {
    contractUsdc: Number(formatUnits(contractUsdcRaw, 6)),
    contractUsyc: Number(formatUnits(contractUsycRaw, 6)),
    totalEligibleIdle: currentMarkets.reduce((sum, market) => sum + market.eligibleIdle, 0),
    totalYieldEarned: currentMarkets.reduce((sum, market) => sum + market.yieldEarned, 0),
    markets: currentMarkets,
  };
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
