import Link from "next/link";
import { CATEGORY_COLORS } from "@/lib/constants";
import { calculateOdds, formatTokenAmount, formatUsdc, timeRemaining } from "@/lib/odds";
import type { Market } from "@/lib/types";

export function MarketCard({ market }: { market: Market }) {
  const odds = calculateOdds(Number(market.yes_pool || 0), Number(market.no_pool || 0), market.initial_probability_yes ?? market.groq_yes_probability);
  const total = Number(market.yes_pool || 0) + Number(market.no_pool || 0);
  const eurcTotal = Number(market.eurc_yes_pool || 0) + Number(market.eurc_no_pool || 0);
  return (
    <article className="relative border-b border-white/10 py-7">
      {market.resolved && (
        <div className="absolute right-0 top-7 border border-[#f5a623] px-3 py-1 text-xs font-black uppercase text-[#f5a623]">
          Resolved: {market.outcome ? "YES" : "NO"}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="px-2 py-1 text-xs font-black text-black" style={{ backgroundColor: CATEGORY_COLORS[market.category] }}>
          {market.category}
        </span>
        <span className="text-xs font-bold text-white/55">{market.country || "AFRICA"}</span>
        <span className="text-xs text-white/45">{timeRemaining(market.resolves_at)}</span>
        {market.agent_seeded && <span className="text-xs font-black text-[#f5a623]">🤖 Agent seeded</span>}
        {market.usyc_invested && !market.resolved && <span className="text-xs font-black text-[#2d6a4f]">💰 Earning yield in USYC while open</span>}
      </div>
      <Link href={`/market/${market.id}`} className="font-display text-2xl font-black leading-tight text-white hover:text-[#f5a623] md:text-4xl">
        {market.question}
      </Link>
      <div className="mt-3 text-sm text-white/55">
        {market.news_items?.url ? (
          <a href={market.news_items.url} target="_blank" rel="noreferrer" className="hover:text-white">
            Via {market.news_items.source_name || "source"}
          </a>
        ) : (
          "Source article unavailable"
        )}
      </div>
      <div className="mt-5 overflow-hidden border border-white/10 bg-[#2d6a4f]">
        <div className="h-3 bg-[#f5a623]" style={{ width: `${odds.yesOdds}%` }} />
      </div>
      {odds.source !== "pool" && (
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-white/40">
          {odds.source === "ai" ? "AI est." : "Neutral opening view until bets set pool odds"}
        </p>
      )}
      {market.resolved && Number(market.yield_earned || 0) > 0 && (
        <p className="mt-2 text-xs font-bold text-[#2d6a4f]">+${formatUsdc(Number(market.yield_earned || 0))} yield earned for winners</p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href={`/market/${market.id}?side=yes`} className="bg-[#f5a623] px-4 py-3 text-center text-sm font-black text-black">
          YES {odds.yesOdds}%
        </Link>
        <Link href={`/market/${market.id}?side=no`} className="bg-[#2d6a4f] px-4 py-3 text-center text-sm font-black text-white">
          NO {odds.noOdds}%
        </Link>
      </div>
      <div className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-white/45">
        {formatTokenAmount(total, "USDC")} + {formatTokenAmount(eurcTotal, "EURC")} at stake
      </div>
    </article>
  );
}
