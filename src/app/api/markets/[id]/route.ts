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
    const onchain = await contract.getMarket(id);
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
    return safeJson({
      market: {
        ...market,
        yes_pool: Number(formatUnits(onchain.yesPool, 6)),
        no_pool: Number(formatUnits(onchain.noPool, 6)),
      },
      bets: mergeBetHistory(databaseBets, chainBets),
      related: related || [],
    });
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unable to fetch market" }, { status: 500 });
  }
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
    const betLogs = await contract.queryFilter(contract.filters.Bet(marketId), fromBlock, toBlock);
    logs.push(...betLogs);
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
    tx_hash: log.transactionHash,
    created_at: blockTimes.get(log.blockNumber) || new Date(0).toISOString(),
  }));
}

function isBetEvent(log: Log | EventLog): log is EventLog {
  return log instanceof EventLog && log.eventName === "Bet";
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
