import { EventLog, formatUnits, getAddress, isAddress, type Log } from "ethers";
import { type NextRequest } from "next/server";
import { getArcProvider, getReadOnlyMarketContract } from "@/lib/chain";
import { safeJson } from "@/lib/json";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { Bet, Market } from "@/lib/types";

export const dynamic = "force-dynamic";

type ActivityMarket = Pick<Market, "id" | "question" | "category" | "country" | "resolved" | "outcome">;
type PredictionActivity = Bet & {
  markets: ActivityMarket | null;
};

export async function GET(request: NextRequest) {
  try {
    const limit = normalizeLimit(request.nextUrl.searchParams.get("limit"));
    const wallet = normalizeWallet(request.nextUrl.searchParams.get("wallet"));
    const supabase = getSupabaseAdmin();
    const contract = getReadOnlyMarketContract();
    const currentMarketCount = Number(await contract.marketCount());
    if (currentMarketCount === 0) return safeJson({ predictions: [] });

    let query = supabase
      .from("bets")
      .select("id,market_id,wallet_address,side,amount_usdc,currency,tx_hash,created_at,markets(id,question,category,country,resolved,outcome)")
      .lte("market_id", currentMarketCount)
      .order("created_at", { ascending: false })
      .limit(limit * 5);
    if (wallet) query = query.ilike("wallet_address", wallet);

    const { data, error } = await query;
    if (error) throw error;

    const databasePredictions = (data || []).map((prediction) => ({
      ...prediction,
      markets: Array.isArray(prediction.markets) ? prediction.markets[0] || null : prediction.markets,
    })) as PredictionActivity[];
    const chainPredictions = wallet ? await fetchWalletChainPredictions(wallet, limit) : [];
    const hydrated = await hydrateMarkets(mergeActivity(databasePredictions, chainPredictions), contract);
    return safeJson({ predictions: hydrated.slice(0, limit) });
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unable to fetch prediction activity" }, { status: 500 });
  }
}

function normalizeLimit(input: string | null) {
  const limit = Number(input || "50");
  if (!Number.isInteger(limit)) return 50;
  return Math.min(100, Math.max(1, limit));
}

function normalizeWallet(input: string | null) {
  if (!input) return "";
  return isAddress(input) ? getAddress(input) : "";
}

async function fetchWalletChainPredictions(wallet: string, limit: number): Promise<PredictionActivity[]> {
  const contract = getReadOnlyMarketContract();
  const provider = getArcProvider();
  const latestBlock = await provider.getBlockNumber();
  const startBlock = Math.max(0, latestBlock - 9_999);
  const logs: Array<Log | EventLog> = [];
  const blockRange = 9_999;

  for (let fromBlock = startBlock; fromBlock <= latestBlock; fromBlock += blockRange + 1) {
    const toBlock = Math.min(latestBlock, fromBlock + blockRange);
    const betLogs = await contract.queryFilter(contract.filters.Bet(null, wallet), fromBlock, toBlock);
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

  const bets = betLogs
    .map((log) => ({
      id: `chain-${log.transactionHash}-${log.index}`,
      market_id: Number(log.args.marketId),
      wallet_address: String(log.args.bettor),
      side: Boolean(log.args.yes),
      amount_usdc: Number(formatUnits(log.args.amount, 6)),
      currency: "USDC" as const,
      tx_hash: log.transactionHash,
      created_at: blockTimes.get(log.blockNumber) || new Date(0).toISOString(),
      markets: null,
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  return hydrateMarkets(bets, contract);
}

async function hydrateMarkets(
  predictions: PredictionActivity[],
  contract = getReadOnlyMarketContract(),
): Promise<PredictionActivity[]> {
  const marketIds = [...new Set(predictions.map((prediction) => prediction.market_id))];
  if (marketIds.length === 0) return predictions;

  const markets = new Map<number, ActivityMarket & { created_at: string }>();
  await Promise.all(
    marketIds.map(async (marketId) => {
      const onchain = await contract.getMarket(marketId);
      if (Number(onchain.id) === 0) return;
      markets.set(marketId, {
        id: Number(onchain.id),
        question: onchain.question,
        category: onchain.category,
        country: onchain.sourceCountry,
        resolved: onchain.resolved,
        outcome: onchain.resolved ? onchain.outcome : null,
        created_at: new Date(Number(onchain.createdAt) * 1000).toISOString(),
      });
    }),
  );

  const currentPredictions: PredictionActivity[] = [];
  for (const prediction of predictions) {
    const market = markets.get(Number(prediction.market_id));
    if (!market) continue;
    if (new Date(prediction.created_at).getTime() < new Date(market.created_at).getTime()) continue;
    const { created_at: _createdAt, ...activityMarket } = market;
    currentPredictions.push({
      ...prediction,
      markets: activityMarket,
    });
  }

  return currentPredictions;
}

function isBetEvent(log: Log | EventLog): log is EventLog {
  return log instanceof EventLog && log.eventName === "Bet";
}

function mergeActivity(databasePredictions: PredictionActivity[], chainPredictions: PredictionActivity[]) {
  const rows = new Map<string, PredictionActivity>();

  for (const prediction of chainPredictions) rows.set(activityKey(prediction), prediction);
  for (const prediction of databasePredictions) rows.set(activityKey(prediction), prediction);

  return [...rows.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function activityKey(prediction: PredictionActivity) {
  return prediction.tx_hash?.toLowerCase() || prediction.id;
}
