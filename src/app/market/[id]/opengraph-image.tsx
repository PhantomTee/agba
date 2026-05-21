import { ImageResponse } from "next/og";
import { calculateOdds } from "@/lib/odds";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "edge";
export const alt = "Market — Àgbà";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: { id: string } }) {
  const supabase = getSupabaseAdmin();
  const { data: market } = await supabase
    .from("markets")
    .select("question,category,yes_pool,no_pool,resolved,outcome")
    .eq("id", Number(params.id))
    .single();

  if (!market) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#080808",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <span style={{ color: "#f5a623", fontSize: 64, fontWeight: 900 }}>Àgbà</span>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  const odds = calculateOdds(Number(market.yes_pool || 0), Number(market.no_pool || 0));
  const q = market.question as string;
  const fontSize = q.length > 90 ? 48 : q.length > 60 ? 56 : 64;

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
          fontFamily: "Arial, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#f5a623", fontSize: 28, fontWeight: 800 }}>Àgbà</span>
          <span
            style={{
              background: "#f5a623",
              color: "#000",
              fontSize: 16,
              fontWeight: 800,
              padding: "6px 16px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {market.category}
          </span>
        </div>

        {/* Question */}
        <div style={{ fontSize, fontWeight: 900, lineHeight: 1.1, color: "white" }}>{q}</div>

        {/* Odds / resolved */}
        {market.resolved ? (
          <div style={{ fontSize: 40, fontWeight: 900, color: "#f5a623" }}>
            Resolved: {market.outcome ? "YES" : "NO"}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 40 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                background: "rgba(245,166,35,0.12)",
                padding: "16px 36px",
              }}
            >
              <span style={{ color: "#f5a623", fontSize: 52, fontWeight: 900 }}>
                {odds.yesOdds}%
              </span>
              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 18, letterSpacing: "0.15em" }}>
                YES
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                background: "rgba(45,106,79,0.2)",
                padding: "16px 36px",
              }}
            >
              <span style={{ color: "#4cc9f0", fontSize: 52, fontWeight: 900 }}>
                {odds.noOdds}%
              </span>
              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 18, letterSpacing: "0.15em" }}>
                NO
              </span>
            </div>
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
