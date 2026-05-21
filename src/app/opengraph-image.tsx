import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Àgbà — Africa's Prediction Market";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
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
          padding: 64,
          fontFamily: "Arial, sans-serif",
        }}
      >
        {/* Top label */}
        <div
          style={{
            color: "#f5a623",
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          Africa&apos;s Prediction Market
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 110, fontWeight: 900, lineHeight: 1, color: "white" }}>
            Àgbà
          </div>
          <div style={{ fontSize: 34, color: "rgba(255,255,255,0.55)", lineHeight: 1.3 }}>
            AI turns African news into live markets.
          </div>
          <div
            style={{
              display: "flex",
              gap: 20,
              marginTop: 8,
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {["FOREX", "POLITICS", "SPORTS", "ECONOMY"].map((cat) => (
              <span
                key={cat}
                style={{
                  background: "rgba(245,166,35,0.15)",
                  color: "#f5a623",
                  padding: "6px 16px",
                  letterSpacing: "0.1em",
                }}
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#f5a623",
            }}
          />
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 20 }}>
            agba.vercel.app · Bet with USDC on Arc
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
