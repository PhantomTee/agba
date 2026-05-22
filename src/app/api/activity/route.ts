import { type NextRequest } from "next/server";
import { safeJson } from "@/lib/json";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const limit = normalizeLimit(request.nextUrl.searchParams.get("limit"));
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("bets")
      .select("id,market_id,wallet_address,side,amount_usdc,tx_hash,created_at,markets(id,question,category,country,resolved,outcome)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return safeJson({ predictions: data || [] });
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unable to fetch prediction activity" }, { status: 500 });
  }
}

function normalizeLimit(input: string | null) {
  const limit = Number(input || "50");
  if (!Number.isInteger(limit)) return 50;
  return Math.min(100, Math.max(1, limit));
}
