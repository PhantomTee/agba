import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [{ data: markets, error: marketsError }, { count: articlesScanned, error: newsError }] = await Promise.all([
      supabase.from("markets").select("category,country,yes_pool,no_pool,resolved"),
      supabase.from("news_items").select("*", { count: "exact", head: true }),
    ]);
    if (marketsError) throw marketsError;
    if (newsError) throw newsError;
    const marketRows = markets || [];
    const totalVolumeUSDC = marketRows.reduce((sum, market) => sum + Number(market.yes_pool || 0) + Number(market.no_pool || 0), 0);
    const marketsByCategory = Object.fromEntries(
      [...new Set(marketRows.map((market) => market.category).filter(Boolean))].map((category) => [
        category,
        marketRows.filter((market) => market.category === category).length,
      ]),
    );
    const marketsByCountry = Object.fromEntries(
      [...new Set(marketRows.map((market) => market.country).filter(Boolean))].map((country) => [
        country,
        marketRows.filter((market) => market.country === country).length,
      ]),
    );
    const totalMarkets = marketRows.length;
    return NextResponse.json({
      totalMarkets,
      openMarkets: marketRows.filter((market) => !market.resolved).length,
      totalVolumeUSDC,
      marketsByCategory,
      marketsByCountry,
      articlesScanned: articlesScanned || 0,
      conversionRate: articlesScanned ? `${((totalMarkets / articlesScanned) * 100).toFixed(1)}% of articles become markets` : "0% of articles become markets",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to fetch stats" }, { status: 500 });
  }
}
