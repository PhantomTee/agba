import { formatUnits, parseUnits } from "ethers";
import { getMarketContract } from "./chain";
import { getOptionalEnv } from "./env";
import { getSupabaseAdmin } from "./supabase";

type AgentYieldSweepOptions = {
  maxMarkets?: number;
  minIdleUsdc?: string;
  maxInvestedBps?: number;
};

export async function runAgentUSYCSweep(options: AgentYieldSweepOptions = {}) {
  const maxMarkets = options.maxMarkets ?? Number(getOptionalEnv("AGENT_USYC_MAX_MARKETS") || "3");
  const minIdleRaw = parseUnits(options.minIdleUsdc ?? getOptionalEnv("AGENT_USYC_MIN_IDLE_USDC") ?? "1", 6);
  const maxInvestedBps = options.maxInvestedBps ?? Number(getOptionalEnv("AGENT_USYC_MAX_INVESTED_BPS") || "7000");
  const cappedMaxInvestedBps = Math.min(9000, Math.max(1000, Math.round(maxInvestedBps)));
  const contract = getMarketContract();
  const supabase = getSupabaseAdmin();
  const [{ data: dbMarkets, error }, marketCount] = await Promise.all([
    supabase.from("markets").select("id,question").eq("resolved", false).order("created_at", { ascending: true }).limit(100),
    contract.marketCount().then((count: bigint) => Number(count)),
  ]);
  if (error) throw error;

  let checked = 0;
  let invested = 0;
  let totalOpenPoolRaw = BigInt(0);
  let totalPrincipalRaw = BigInt(0);
  let skipped = 0;
  const investments: Array<{ marketId: number; investedUsdc: string; txHash: string }> = [];
  const failures: Array<{ marketId: number; error: string }> = [];

  for (const row of dbMarkets || []) {
    const marketId = Number(row.id);
    if (!Number.isInteger(marketId) || marketId <= 0 || marketId > marketCount) continue;
    try {
      const [market, principalRaw] = await Promise.all([
        contract.getMarket(marketId),
        contract.marketUsycPrincipal(marketId).catch(() => BigInt(0)),
      ]);
      if (Number(market.id) === 0 || market.resolved) continue;
      totalOpenPoolRaw += market.yesPool + market.noPool;
      totalPrincipalRaw += principalRaw;
    } catch {
      continue;
    }
  }

  const maxInvestedRaw = (totalOpenPoolRaw * BigInt(cappedMaxInvestedBps)) / BigInt(10_000);
  let remainingInvestCapacityRaw = maxInvestedRaw > totalPrincipalRaw ? maxInvestedRaw - totalPrincipalRaw : BigInt(0);

  for (const row of dbMarkets || []) {
    if (invested >= maxMarkets || remainingInvestCapacityRaw === BigInt(0)) break;
    const marketId = Number(row.id);
    if (!Number.isInteger(marketId) || marketId <= 0 || marketId > marketCount) {
      skipped += 1;
      continue;
    }

    checked += 1;
    try {
      const [market, principalRaw, usycBalanceRaw] = await Promise.all([
        contract.getMarket(marketId),
        contract.marketUsycPrincipal(marketId).catch(() => BigInt(0)),
        contract.getMarketUSYCBalance(marketId).catch(() => BigInt(0)),
      ]);
      if (Number(market.id) === 0 || market.resolved) {
        skipped += 1;
        continue;
      }

      const poolRaw = market.yesPool + market.noPool;
      const availableRaw = poolRaw > principalRaw ? poolRaw - principalRaw : BigInt(0);
      if (availableRaw < minIdleRaw) {
        skipped += 1;
        continue;
      }

      const investRaw = availableRaw > remainingInvestCapacityRaw ? remainingInvestCapacityRaw : availableRaw;
      if (investRaw < minIdleRaw) {
        skipped += 1;
        continue;
      }

      const tx = await contract.investInUSYC(marketId, investRaw);
      const receipt = await tx.wait();
      const { error: updateError } = await supabase.from("markets").update({ usyc_invested: true }).eq("id", marketId);
      if (updateError && !isMissingOptionalMarketColumnError(updateError)) throw updateError;

      invested += 1;
      remainingInvestCapacityRaw = investRaw >= remainingInvestCapacityRaw ? BigInt(0) : remainingInvestCapacityRaw - investRaw;
      investments.push({
        marketId,
        investedUsdc: formatUnits(investRaw, 6),
        txHash: receipt?.hash || tx.hash,
      });

      if (usycBalanceRaw === BigInt(0)) {
        await supabase.channel("agent_yield").send({
          type: "broadcast",
          event: "invested",
          payload: { marketId, investedUsdc: formatUnits(investRaw, 6), txHash: receipt?.hash || tx.hash },
        });
      }
    } catch (error) {
      failures.push({ marketId, error: error instanceof Error ? error.message : "USYC investment failed" });
    }
  }

  return {
    checked,
    invested,
    skipped,
    minIdleUsdc: formatUnits(minIdleRaw, 6),
    maxInvestedBps: cappedMaxInvestedBps,
    targetInvestedUsdc: formatUnits(maxInvestedRaw, 6),
    currentInvestedUsdc: formatUnits(totalPrincipalRaw, 6),
    remainingInvestCapacityUsdc: formatUnits(remainingInvestCapacityRaw, 6),
    investments,
    failures,
  };
}

function isMissingOptionalMarketColumnError(error: { code?: string; message?: string }) {
  return error.code === "PGRST204" || Boolean(error.message?.includes("usyc_invested") && error.message.toLowerCase().includes("column"));
}
