import { formatUnits, parseUnits } from "ethers";
import { type NextRequest } from "next/server";
import { getArcProvider, getReadOnlyMarketContract } from "@/lib/chain";
import { getEnv } from "@/lib/env";
import { safeJson } from "@/lib/json";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const marketId = Number(body.marketId);
    const side = Boolean(body.side);
    const amount = Number(body.amount);
    const txHash = String(body.txHash || "");
    const walletAddress = String(body.walletAddress || "");
    if (!Number.isInteger(marketId) || amount <= 0 || !txHash || !walletAddress) {
      return safeJson({ error: "marketId, side, amount, txHash, and walletAddress are required" }, { status: 400 });
    }
    const provider = getArcProvider();
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      return safeJson({ error: "Transaction receipt not found or failed on Arc RPC" }, { status: 400 });
    }
    if (receipt.to?.toLowerCase() !== getEnv("NEXT_PUBLIC_CONTRACT_ADDRESS").toLowerCase()) {
      return safeJson({ error: "Transaction was not sent to the Àgbà market contract" }, { status: 400 });
    }
    const contract = getReadOnlyMarketContract();
    const expectedAmount = parseUnits(String(amount), 6);
    const betEvent = receipt.logs
      .map((log) => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((event) => event?.name === "Bet");
    if (!betEvent) {
      return safeJson({ error: "Transaction did not emit an Agba Bet event" }, { status: 400 });
    }
    const eventMarketId = Number(betEvent.args.marketId);
    const eventBettor = String(betEvent.args.bettor);
    const eventSide = Boolean(betEvent.args.yes);
    const eventAmount = BigInt(betEvent.args.amount);
    if (
      eventMarketId !== marketId ||
      eventBettor.toLowerCase() !== walletAddress.toLowerCase() ||
      eventSide !== side ||
      eventAmount !== expectedAmount
    ) {
      return safeJson({ error: "Bet transaction details do not match the request" }, { status: 400 });
    }
    const onchain = await contract.getMarket(marketId);
    const yesPool = Number(formatUnits(onchain.yesPool, 6));
    const noPool = Number(formatUnits(onchain.noPool, 6));
    const supabase = getSupabaseAdmin();
    const { error: betError } = await supabase.from("bets").insert({
      market_id: marketId,
      wallet_address: walletAddress,
      side,
      amount_usdc: amount,
      tx_hash: txHash,
    });
    if (betError && betError.code !== "23505") throw betError;
    const { error: marketError } = await supabase.from("markets").update({ yes_pool: yesPool, no_pool: noPool }).eq("id", marketId);
    if (marketError) throw marketError;
    const total = yesPool + noPool;
    return safeJson({
      success: true,
      newYesPool: yesPool,
      newNoPool: noPool,
      impliedOdds: total > 0 ? { yes: yesPool / total, no: noPool / total } : { yes: 0.5, no: 0.5 },
    });
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unable to record bet" }, { status: 500 });
  }
}
