import { formatUnits } from "ethers";
import { NextResponse, type NextRequest } from "next/server";
import { getReadOnlyMarketContract } from "@/lib/chain";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid market id" }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const [{ data: market, error: marketError }, { data: bets, error: betsError }] = await Promise.all([
      supabase.from("markets").select("*, news_items(*)").eq("id", id).single(),
      supabase.from("bets").select("*").eq("market_id", id).order("created_at", { ascending: false }),
    ]);
    if (marketError) throw marketError;
    if (betsError) throw betsError;
    const contract = getReadOnlyMarketContract();
    const onchain = await contract.getMarket(id);
    const { data: related, error: relatedError } = await supabase
      .from("markets")
      .select("*")
      .eq("category", market.category)
      .neq("id", id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (relatedError) throw relatedError;
    return NextResponse.json({
      market: {
        ...market,
        yes_pool: Number(formatUnits(onchain.yesPool, 6)),
        no_pool: Number(formatUnits(onchain.noPool, 6)),
      },
      bets: bets || [],
      related: related || [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to fetch market" }, { status: 500 });
  }
}
