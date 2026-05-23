import type { Metadata } from "next";
import { PredictionActivityClient, type PredictionActivity } from "@/components/PredictionActivityClient";
import { getReadOnlyMarketContract } from "@/lib/chain";
import { getSupabaseAdmin } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Prediction Activity",
  description: "Recent real prediction activity across Agba markets.",
};

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const initialPredictions = await fetchInitialPredictions();
  return <PredictionActivityClient initialPredictions={initialPredictions} />;
}

async function fetchInitialPredictions(): Promise<PredictionActivity[]> {
  const supabase = getSupabaseAdmin();
  const contract = getReadOnlyMarketContract();
  const currentMarketCount = Number(await contract.marketCount());
  if (currentMarketCount === 0) return [];

  const { data, error } = await supabase
    .from("bets")
    .select("id,market_id,wallet_address,side,amount_usdc,currency,tx_hash,created_at,markets(id,question,category,country,resolved,outcome)")
    .lte("market_id", currentMarketCount)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return [];

  const predictions = (data || []).map((prediction) => ({
    ...prediction,
    markets: Array.isArray(prediction.markets) ? prediction.markets[0] || null : prediction.markets,
  })) as PredictionActivity[];
  return hydrateCurrentMarketActivity(predictions, contract);
}

async function hydrateCurrentMarketActivity(
  predictions: PredictionActivity[],
  contract: ReturnType<typeof getReadOnlyMarketContract>,
): Promise<PredictionActivity[]> {
  const marketIds = [...new Set(predictions.map((prediction) => prediction.market_id))];
  const markets = new Map<number, NonNullable<PredictionActivity["markets"]> & { created_at: string }>();

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
    currentPredictions.push({ ...prediction, markets: activityMarket });
  }

  return currentPredictions;
}
