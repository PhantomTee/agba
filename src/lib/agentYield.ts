import { Contract, formatUnits, parseUnits } from "ethers";
import { getAgentWallet, getMarketContract } from "./chain";
import { ERC20_ABI, TELLER_ABI } from "./constants";
import { getEnv, getOptionalEnv } from "./env";
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
  console.log("[agentYield] sweep started", { maxMarkets, minIdleUsdc: formatUnits(minIdleRaw, 6) });
  const supabase = getSupabaseAdmin();

  const [{ data: dbMarkets, error }, marketCount] = await Promise.all([
    supabase.from("markets").select("id,question").is("resolved", false).order("created_at", { ascending: true }).limit(100),
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
      totalOpenPoolRaw += BigInt(market.yesPool ?? 0) + BigInt(market.noPool ?? 0);
      totalPrincipalRaw += BigInt(principalRaw ?? 0);
    } catch {
      continue;
    }
  }

  const maxInvestedRaw = (totalOpenPoolRaw * BigInt(cappedMaxInvestedBps)) / BigInt(10_000);
  let remainingInvestCapacityRaw = maxInvestedRaw > totalPrincipalRaw ? maxInvestedRaw - totalPrincipalRaw : BigInt(0);

  console.log("[agentYield] capacity computed", {
    totalPoolUsdc: formatUnits(totalOpenPoolRaw, 6),
    maxInvestedBps: cappedMaxInvestedBps,
    investCapacityUsdc: formatUnits(maxInvestedRaw, 6),
    alreadyInvestedUsdc: formatUnits(totalPrincipalRaw, 6),
    remainingCapacityUsdc: formatUnits(remainingInvestCapacityRaw, 6),
  });

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
      if (Number(market.id) === 0 || market.resolved) { skipped += 1; continue; }

      const poolRaw = BigInt(market.yesPool ?? 0) + BigInt(market.noPool ?? 0);
      const principalBig = BigInt(principalRaw ?? 0);
      const availableRaw = poolRaw > principalBig ? poolRaw - principalBig : BigInt(0);
      if (availableRaw < minIdleRaw) { skipped += 1; continue; }

      const investRaw = availableRaw > remainingInvestCapacityRaw ? remainingInvestCapacityRaw : availableRaw;
      if (investRaw < minIdleRaw) { skipped += 1; continue; }

      console.log("[agentYield] investing", { marketId, investUsdc: formatUnits(investRaw, 6) });

      // Step 1: contract transfers USDC to owner wallet, records principal
      const investTx = await contract.investInUSYC(marketId, investRaw);
      const investReceipt = await investTx.wait();

      // Step 2: owner calls teller directly to convert USDC → USYC
      const shares = await callTellerDeposit(investRaw);
      if (shares <= BigInt(0)) throw new Error("no USYC shares received from teller");

      // Step 3: record USYC shares on contract
      const recordTx = await contract.recordUSYCShares(marketId, shares);
      await recordTx.wait();

      const txHash = investReceipt?.hash || investTx.hash;
      const { error: updateError } = await supabase.from("markets").update({ usyc_invested: true }).eq("id", marketId);
      if (updateError && !isMissingOptionalMarketColumnError(updateError)) throw updateError;

      invested += 1;
      remainingInvestCapacityRaw = investRaw >= remainingInvestCapacityRaw ? BigInt(0) : remainingInvestCapacityRaw - investRaw;
      console.log("[agentYield] invest success", { marketId, investedUsdc: formatUnits(investRaw, 6), shares: shares.toString(), txHash });
      investments.push({ marketId, investedUsdc: formatUnits(investRaw, 6), txHash });

      if (usycBalanceRaw === BigInt(0)) {
        await supabase.channel("agent_yield").send({
          type: "broadcast",
          event: "invested",
          payload: { marketId, investedUsdc: formatUnits(investRaw, 6), txHash },
        });
      }
    } catch (error) {
      console.error("[agentYield] invest failed", { marketId, error: error instanceof Error ? error.message : String(error) });
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

// Owner wallet calls teller deposit/buy directly — returns USYC shares received
async function callTellerDeposit(usdcAmount: bigint): Promise<bigint> {
  const wallet = getAgentWallet();
  const tellerAddress = getOptionalEnv("NEXT_PUBLIC_USYC_TELLER") || "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A";
  const usycAddress = getOptionalEnv("NEXT_PUBLIC_USYC_ADDRESS") || "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C";
  const usdcAddress = getEnv("NEXT_PUBLIC_USDC_ADDRESS");

  const usdc = new Contract(usdcAddress, ERC20_ABI, wallet);
  const usyc = new Contract(usycAddress, ERC20_ABI, wallet);
  const teller = new Contract(tellerAddress, TELLER_ABI, wallet);

  await (await usdc.approve(tellerAddress, usdcAmount)).wait();

  const before = await usyc.balanceOf(wallet.address) as bigint;

  let success = false;
  try {
    await (await teller["deposit(uint256,address)"](usdcAmount, wallet.address)).wait();
    success = true;
  } catch {
    try {
      await (await teller["buy(uint256,address)"](usdcAmount, wallet.address)).wait();
      success = true;
    } catch {}
  }

  if (!success) throw new Error("teller deposit/buy failed");

  const after = await usyc.balanceOf(wallet.address) as bigint;
  return after - before;
}

// Owner wallet redeems USYC via teller, then pushes USDC back to contract
export async function completeUSYCRedemption(
  contract: ReturnType<typeof getMarketContract>,
  marketId: number,
  shares: bigint,
): Promise<number> {
  const wallet = getAgentWallet();
  const tellerAddress = getOptionalEnv("NEXT_PUBLIC_USYC_TELLER") || "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A";
  const usycAddress = getOptionalEnv("NEXT_PUBLIC_USYC_ADDRESS") || "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C";
  const usdcAddress = getEnv("NEXT_PUBLIC_USDC_ADDRESS");
  const contractAddress = getEnv("NEXT_PUBLIC_CONTRACT_ADDRESS");

  const usyc = new Contract(usycAddress, ERC20_ABI, wallet);
  const usdc = new Contract(usdcAddress, ERC20_ABI, wallet);
  const teller = new Contract(tellerAddress, TELLER_ABI, wallet);

  await (await usyc.approve(tellerAddress, shares)).wait();

  const before = await usdc.balanceOf(wallet.address) as bigint;

  let success = false;
  try {
    await (await teller["redeem(uint256,address,address)"](shares, wallet.address, wallet.address)).wait();
    success = true;
  } catch {
    try {
      await (await teller["sell(uint256,address)"](shares, wallet.address)).wait();
      success = true;
    } catch {}
  }

  if (!success) throw new Error("teller redeem/sell failed");

  const after = await usdc.balanceOf(wallet.address) as bigint;
  const usdcReceived = after - before;

  // Approve contract to pull USDC from owner, then complete on-chain
  await (await usdc.approve(contractAddress, usdcReceived)).wait();
  const tx = await contract.completeRedemption(marketId, usdcReceived);
  await tx.wait();

  return Number(formatUnits(usdcReceived, 6));
}

function isMissingOptionalMarketColumnError(error: { code?: string; message?: string }) {
  return error.code === "PGRST204" || Boolean(error.message?.includes("usyc_invested") && error.message.toLowerCase().includes("column"));
}
