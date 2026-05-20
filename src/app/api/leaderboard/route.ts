import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: bets, error } = await supabase.from("bets").select("wallet_address,amount_usdc,side,market_id,markets(outcome,resolved)");
    if (error) throw error;
    const rows = new Map<string, { wallet: string; volume: number; won: number; settled: number; correct: number }>();
    for (const bet of bets || []) {
      const wallet = bet.wallet_address;
      const current = rows.get(wallet) || { wallet, volume: 0, won: 0, settled: 0, correct: 0 };
      current.volume += Number(bet.amount_usdc || 0);
      const market = Array.isArray(bet.markets) ? bet.markets[0] : bet.markets;
      if (market?.resolved) {
        current.settled += 1;
        if (market.outcome === bet.side) {
          current.correct += 1;
          current.won += Number(bet.amount_usdc || 0);
        }
      }
      rows.set(wallet, current);
    }
    const leaderboard = [...rows.values()].map((row) => ({
      ...row,
      accuracy: row.settled ? row.correct / row.settled : 0,
    }));
    return NextResponse.json({
      byVolume: [...leaderboard].sort((a, b) => b.volume - a.volume).slice(0, 20),
      byWon: [...leaderboard].sort((a, b) => b.won - a.won).slice(0, 20),
      byAccuracy: [...leaderboard].filter((row) => row.settled > 0).sort((a, b) => b.accuracy - a.accuracy).slice(0, 20),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to fetch leaderboard" }, { status: 500 });
  }
}
