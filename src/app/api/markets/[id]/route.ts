import { EventLog, formatUnits, type Log } from "ethers";
import { type NextRequest } from "next/server";
import { getArcProvider, getReadOnlyMarketContract } from "@/lib/chain";
import { safeJson } from "@/lib/json";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { Bet } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return safeJson({ error: "Invalid market id" }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const [{ data: market, error: marketError }, databaseBets] = await Promise.all([
      supabase.from("markets").select("*, news_items(*)").eq("id", id).single(),
      fetchDatabaseBets(id),
    ]);
    if (marketError) throw marketError;
    const contract = getReadOnlyMarketContract();
    const [onchain, eurcPools, usycBalance, yieldEarned] = await Promise.all([
      contract.getMarket(id),
      contract.getEURCPools(id),
      contract.getMarketUSYCBalance(id),
      contract.getMarketYieldEarned(id),
    ]);
    if (Number(onchain.id) === 0) {
      return safeJson({ error: "Market not found on current contract" }, { status: 404 });
    }
    const chainTotal = Number(formatUnits(onchain.yesPool + onchain.noPool, 6));
    const recordedTotal = databaseBets.reduce((total, bet) => total + Number(bet.amount_usdc || 0), 0);
    const chainBets = chainTotal > recordedTotal ? await fetchChainBets(id) : [];
    const { data: related, error: relatedError } = await supabase
      .from("markets")
      .select("*")
      .eq("category", market.category)
      .neq("id", id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (relatedError) throw relatedError;
    const currentRelated = await enrichCurrentContractMarkets(contract, related || []);
    return safeJson({
      market: {
        ...market,
        question: onchain.question,
        category: onchain.category,
        country: onchain.sourceCountry,
        created_at: new Date(Number(onchain.createdAt) * 1000).toISOString(),
        resolves_at: new Date(Number(onchain.resolvesAt) * 1000).toISOString(),
        resolved: onchain.resolved,
        outcome: onchain.resolved ? onchain.outcome : null,
        news_items: market.news_items
          ? {
              ...market.news_items,
              headline: onchain.newsHeadline,
              url: onchain.newsUrl,
              country: onchain.sourceCountry,
            }
          : market.news_items,
        yes_pool: Number(formatUnits(onchain.yesPool, 6)),
        no_pool: Number(formatUnits(onchain.noPool, 6)),
        eurc_yes_pool: Number(formatUnits(eurcPools.yesPool, 6)),
        eurc_no_pool: Number(formatUnits(eurcPools.noPool, 6)),
        initial_probability_yes: Number(onchain.initialProbabilityYes ?? market.initial_probability_yes ?? 50),
        usyc_invested: Number(usycBalance) > 0 || Boolean(market.usyc_invested),
        yield_earned: Number(formatUnits(yieldEarned, 6)),
      },
      bets: mergeBetHistory(databaseBets, chainBets),
      related: currentRelated,
    });
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unable to fetch market" }, { status: 500 });
  }
}

async function enrichCurrentContractMarkets(contract: ReturnType<typeof getReadOnlyMarketContract>, markets: Array<Record<string, unknown>>) {
  const enriched = await Promise.all(
    markets.map(async (market) => {
      const marketId = Number(market.id);
      const [onchain, eurcPools] = await Promise.all([contract.getMarket(marketId), contract.getEURCPools(marketId)]);
      if (Number(onchain.id) === 0) return null;
      return {
        ...market,
        question: onchain.question,
        category: onchain.category,
        country: onchain.sourceCountry,
        created_at: new Date(Number(onchain.createdAt) * 1000).toISOString(),
        resolves_at: new Date(Number(onchain.resolvesAt) * 1000).toISOString(),
        resolved: onchain.resolved,
        outcome: onchain.resolved ? onchain.outcome : null,
        yes_pool: Number(formatUnits(onchain.yesPool, 6)),
        no_pool: Number(formatUnits(onchain.noPool, 6)),
        eurc_yes_pool: Number(formatUnits(eurcPools.yesPool, 6)),
        eurc_no_pool: Number(formatUnits(eurcPools.noPool, 6)),
        initial_probability_yes: Number(onchain.initialProbabilityYes ?? market.initial_probability_yes ?? 50),
      };
    }),
  );

  return enriched.filter((market) => market !== null);
}

async function fetchDatabaseBets(marketId: number) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bets")
    .select("*")
    .eq("market_id", marketId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (data && data.length > 0) return data as Bet[];

  const { data: recentBets, error: recentError } = await supabase
    .from("bets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (recentError) throw recentError;
  return ((recentBets || []) as Bet[]).filter((bet) => Number(bet.market_id) === marketId);
}

async function fetchChainBets(marketId: number): Promise<Bet[]> {
  const contract = getReadOnlyMarketContract();
  const provider = getArcProvider();
  const latestBlock = await provider.getBlockNumber();
  const startBlock = Math.max(0, latestBlock - 9_999);
  const logs: Array<Log | EventLog> = [];
  const blockRange = 9_999;

  for (let fromBlock = startBlock; fromBlock <= latestBlock; fromBlock += blockRange + 1) {
    const toBlock = Math.min(latestBlock, fromBlock + blockRange);
    const [usdcLogs, eurcLogs] = await Promise.all([
      contract.queryFilter(contract.filters.Bet(marketId), fromBlock, toBlock),
      contract.queryFilter(contract.filters.EURCBet(marketId), fromBlock, toBlock),
    ]);
    logs.push(...usdcLogs, ...eurcLogs);
  }

  const betLogs = logs.filter(isBetEvent);
  const blockTimes = new Map<number, string>();

  await Promise.all(
    [...new Set(betLogs.map((log) => log.blockNumber))].map(async (blockNumber) => {
      const block = await provider.getBlock(blockNumber);
      if (block) blockTimes.set(blockNumber, new Date(Number(block.timestamp) * 1000).toISOString());
    }),
  );

  return betLogs.map((log) => ({
    id: `chain-${log.transactionHash}-${log.index}`,
    market_id: Number(log.args.marketId),
    wallet_address: String(log.args.bettor),
    side: Boolean(log.args.yes),
    amount_usdc: Number(formatUnits(log.args.amount, 6)),
    currency: log.eventName === "EURCBet" ? "EURC" : "USDC",
    tx_hash: log.transactionHash,
    created_at: blockTimes.get(log.blockNumber) || new Date(0).toISOString(),
  }));
}

function isBetEvent(log: Log | EventLog): log is EventLog {
  return log instanceof EventLog && (log.eventName === "Bet" || log.eventName === "EURCBet");
}

function mergeBetHistory(databaseBets: Bet[], chainBets: Bet[]) {
  const rows = new Map<string, Bet>();

  for (const bet of chainBets) rows.set(betKey(bet), bet);
  for (const bet of databaseBets) rows.set(betKey(bet), bet);

  return [...rows.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function betKey(bet: Bet) {
  return bet.tx_hash?.toLowerCase() || bet.id;
}
