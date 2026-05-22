import { type NextRequest } from "next/server";
import { formatUnits } from "ethers";
import { getMarketContract } from "@/lib/chain";
import { assertAdminRequest } from "@/lib/auth";
import { safeJson } from "@/lib/json";
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
      return safeJson({ error: "marketId is required" }, { status: 400 });
    }
    const contract = getMarketContract();
    const tx = await contract.resolveMarket(marketId, outcome);
    const receipt = await tx.wait();
    const yieldEarned = extractYieldEarned(contract, receipt);
    const supabase = getSupabaseAdmin();
    const { error: marketError } = await supabase
      .from("markets")
      .update({
        resolved: true,
        outcome,
        groq_resolution_reasoning: adminNote || "Manually resolved by admin",
        yield_earned: yieldEarned,
      })
      .eq("id", marketId);
    if (marketError) throw marketError;
    const { error: pendingError } = await supabase
      .from("pending_resolution")
      .update({ resolved: true, admin_note: adminNote })
      .eq("market_id", marketId);
    if (pendingError) throw pendingError;
    return safeJson({ success: true, txHash: receipt?.hash || tx.hash });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve market";
    return safeJson({ error: message }, { status: message.startsWith("Unauthorized") ? 401 : 500 });
  }
}

function extractYieldEarned(contract: ReturnType<typeof getMarketContract>, receipt: { logs?: unknown[] } | null | undefined) {
  const log = receipt?.logs
    ?.map((entry) => {
      try {
        return contract.interface.parseLog(entry as never);
      } catch {
        return null;
      }
    })
    .find((entry) => entry?.name === "MarketUSYCRedeemed");
  return log?.args?.yieldEarned ? Number(formatUnits(log.args.yieldEarned, 6)) : 0;
}
