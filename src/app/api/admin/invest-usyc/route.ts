import { formatUnits, parseUnits } from "ethers";
import { type NextRequest } from "next/server";
import { assertAdminRequest } from "@/lib/auth";
import { getMarketContract } from "@/lib/chain";
import { safeJson } from "@/lib/json";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertAdminRequest(request);
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unauthorized admin request" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const marketId = Number(body.marketId);
    const amount = Number(body.amountUsdc);
    if (!Number.isInteger(marketId) || marketId <= 0) return safeJson({ error: "Invalid market id" }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return safeJson({ error: "Invalid USDC amount" }, { status: 400 });

    const contract = getMarketContract();
    const [market, principalRaw] = await Promise.all([
      contract.getMarket(marketId),
      contract.marketUsycPrincipal(marketId).catch(() => BigInt(0)),
    ]);
    if (Number(market.id) === 0) return safeJson({ error: "Market not found on current contract" }, { status: 404 });
    if (market.resolved) return safeJson({ error: "Cannot invest a resolved market" }, { status: 400 });

    const poolRaw = market.yesPool + market.noPool;
    const requestedRaw = parseUnits(String(amount), 6);
    const availableRaw = poolRaw > principalRaw ? poolRaw - principalRaw : BigInt(0);
    if (requestedRaw > availableRaw) {
      return safeJson(
        { error: `Amount exceeds eligible idle USDC. Available: ${formatUnits(availableRaw, 6)} USDC` },
        { status: 400 },
      );
    }

    const tx = await contract.investInUSYC(marketId, requestedRaw);
    const receipt = await tx.wait();
    const usycBalance = await contract.getMarketUSYCBalance(marketId);

    const supabase = getSupabaseAdmin();
    const { error: updateError } = await supabase.from("markets").update({ usyc_invested: true }).eq("id", marketId);
    if (updateError && !isMissingOptionalMarketColumnError(updateError)) throw updateError;

    return safeJson({
      txHash: receipt?.hash || tx.hash,
      marketId,
      investedUsdc: formatUnits(requestedRaw, 6),
      marketUsycBalance: formatUnits(usycBalance, 6),
    });
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unable to invest market USDC in USYC" }, { status: 500 });
  }
}

function isMissingOptionalMarketColumnError(error: { code?: string; message?: string }) {
  return error.code === "PGRST204" || Boolean(error.message?.includes("usyc_invested") && error.message.toLowerCase().includes("column"));
}
