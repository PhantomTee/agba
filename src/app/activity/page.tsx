import type { Metadata } from "next";
import { PredictionActivityClient, type PredictionActivity } from "@/components/PredictionActivityClient";
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
  const { data, error } = await supabase
    .from("bets")
    .select("id,market_id,wallet_address,side,amount_usdc,currency,tx_hash,created_at,markets(id,question,category,country,resolved,outcome)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return [];

  return (data || []).map((prediction) => ({
    ...prediction,
    markets: Array.isArray(prediction.markets) ? prediction.markets[0] || null : prediction.markets,
  })) as PredictionActivity[];
}
