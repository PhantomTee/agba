import { NextResponse, type NextRequest } from "next/server";
import { getMarketContract } from "@/lib/chain";
import { assertAdminRequest } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertAdminRequest(request);
    const body = await request.json();
    const marketId = Number(body.marketId);
    const outcome = Boolean(body.outcome);
    const adminNote = String(body.adminNote || "");
    if (!Number.isInteger(marketId)) {
      return NextResponse.json({ error: "marketId is required" }, { status: 400 });
    }
    const contract = getMarketContract();
    const tx = await contract.resolveMarket(marketId, outcome);
    const receipt = await tx.wait();
    const supabase = getSupabaseAdmin();
    const { error: marketError } = await supabase
      .from("markets")
      .update({
        resolved: true,
        outcome,
        groq_resolution_reasoning: adminNote || "Manually resolved by admin",
      })
      .eq("id", marketId);
    if (marketError) throw marketError;
    const { error: pendingError } = await supabase
      .from("pending_resolution")
      .update({ resolved: true, admin_note: adminNote })
      .eq("market_id", marketId);
    if (pendingError) throw pendingError;
    return NextResponse.json({ success: true, txHash: receipt?.hash || tx.hash });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve market";
    return NextResponse.json({ error: message }, { status: message.startsWith("Unauthorized") ? 401 : 500 });
  }
}
