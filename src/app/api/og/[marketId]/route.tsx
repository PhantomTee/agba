import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { calculateOdds } from "@/lib/odds";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "edge";

export async function GET(_: NextRequest, { params }: { params: { marketId: string } }) {
  const supabase = getSupabaseAdmin();
  const { data: market, error } = await supabase.from("markets").select("*").eq("id", Number(params.marketId)).single();
  if (error) {
    return new Response(error.message, { status: 500 });
  }
  const odds = calculateOdds(Number(market.yes_pool || 0), Number(market.no_pool || 0));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#080808",
          color: "white",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          fontFamily: "Arial",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", color: "#f5a623", fontSize: 32, fontWeight: 800 }}>
          <span>AGBA</span>
          <span>{market.category}</span>
        </div>
        <div style={{ fontSize: 64, lineHeight: 1.05, fontWeight: 900 }}>{market.question}</div>
        <div style={{ display: "flex", gap: 24, fontSize: 40 }}>
          <span style={{ color: "#f5a623" }}>YES {odds.yesOdds}%</span>
          <span style={{ color: "#2d6a4f" }}>NO {odds.noOdds}%</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
