import { Contract, formatUnits } from "ethers";
import { type NextRequest, NextResponse } from "next/server";
import { getArcProvider, getReadOnlyMarketContract, getReadOnlyUsdcContract } from "@/lib/chain";
import { ERC20_ABI } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ActivityItem = {
  type: "invested" | "redeemed";
  marketId: number;
  question: string;
  usdcAmount: number;
  usycShares: number;
  yieldEarned: number;
  txHash: string;
  blockNumber: number;
};

export type YieldChainResponse = {
  contractUsdc: number;
  contractUsyc: number;
  perMarket: Array<{
    id: number;
    investedPrincipal: number;
    usycShares: number;
    yieldEarned: number;
  }>;
  activity: ActivityItem[];
};

type InvestedLog = {
  args?: { marketId?: bigint; usdcAmount?: bigint; usycShares?: bigint };
  transactionHash: string;
  blockNumber: number;
};
type RedeemedLog = {
  args?: { marketId?: bigint; usdcReceived?: bigint; yieldEarned?: bigint };
  transactionHash: string;
  blockNumber: number;
};

export async function GET(_req: NextRequest) {
  try {
    const contractAddress = getEnv("NEXT_PUBLIC_CONTRACT_ADDRESS");
    const usycAddress = getEnv("NEXT_PUBLIC_USYC_ADDRESS");
    const provider = getArcProvider();
    const contract = getReadOnlyMarketContract();
    const usdc = getReadOnlyUsdcContract();
    const usyc = new Contract(usycAddress, ERC20_ABI, provider);
    const supabase = getSupabaseAdmin();

    const { data: dbMarkets } = await supabase
      .from("markets")
      .select("id,question")
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(50);

    const marketIds = (dbMarkets || []).map((m) => Number(m.id)).filter((id) => id > 0);
    const questionMap = new Map<number, string>(
      (dbMarkets || []).map((m) => [Number(m.id), String(m.question)])
    );

    const [contractUsdcRaw, contractUsycRaw, investedLogs, redeemedLogs] = await Promise.all([
      usdc.balanceOf(contractAddress).catch(() => BigInt(0)) as Promise<bigint>,
      usyc.balanceOf(contractAddress).catch(() => BigInt(0)) as Promise<bigint>,
      contract.queryFilter(contract.filters.MarketUSYCInvested()).catch(() => []) as Promise<InvestedLog[]>,
      contract.queryFilter(contract.filters.MarketUSYCRedeemed()).catch(() => []) as Promise<RedeemedLog[]>,
    ]);

    const perMarket = await Promise.all(
      marketIds.map(async (id) => {
        try {
          const [principalRaw, usycSharesRaw, yieldRaw] = await Promise.all([
            contract.marketUsycPrincipal(id).catch(() => BigInt(0)) as Promise<bigint>,
            contract.getMarketUSYCBalance(id).catch(() => BigInt(0)) as Promise<bigint>,
            contract.getMarketYieldEarned(id).catch(() => BigInt(0)) as Promise<bigint>,
          ]);
          return {
            id,
            investedPrincipal: Number(formatUnits(principalRaw, 6)),
            usycShares: Number(formatUnits(usycSharesRaw, 6)),
            yieldEarned: Number(formatUnits(yieldRaw, 6)),
          };
        } catch {
          return { id, investedPrincipal: 0, usycShares: 0, yieldEarned: 0 };
        }
      })
    );

    const eventMarketIds = [
      ...new Set([
        ...investedLogs.map((l) => Number(l.args?.marketId || 0)),
        ...redeemedLogs.map((l) => Number(l.args?.marketId || 0)),
      ]),
    ].filter((id) => id > 0 && !questionMap.has(id));

    if (eventMarketIds.length > 0) {
      const { data: resolvedRows } = await supabase
        .from("markets")
        .select("id,question")
        .in("id", eventMarketIds);
      for (const row of resolvedRows || []) questionMap.set(Number(row.id), String(row.question));
    }

    const eventActivity: ActivityItem[] = [
      ...investedLogs.map((log) => ({
        type: "invested" as const,
        marketId: Number(log.args?.marketId || 0),
        question:
          questionMap.get(Number(log.args?.marketId || 0)) ??
          `Market #${Number(log.args?.marketId || 0)}`,
        usdcAmount: Number(formatUnits(log.args?.usdcAmount ?? BigInt(0), 6)),
        usycShares: Number(formatUnits(log.args?.usycShares ?? BigInt(0), 6)),
        yieldEarned: 0,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      })),
      ...redeemedLogs.map((log) => ({
        type: "redeemed" as const,
        marketId: Number(log.args?.marketId || 0),
        question:
          questionMap.get(Number(log.args?.marketId || 0)) ??
          `Market #${Number(log.args?.marketId || 0)}`,
        usdcAmount: Number(formatUnits(log.args?.usdcReceived ?? BigInt(0), 6)),
        usycShares: 0,
        yieldEarned: Number(formatUnits(log.args?.yieldEarned ?? BigInt(0), 6)),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      })),
    ]
      .filter((e) => e.marketId > 0)
      .sort((a, b) => b.blockNumber - a.blockNumber)
      .slice(0, 50);

    // Fall back to synthesising activity from on-chain perMarket state when the
    // RPC returns no event history (common on testnets with limited log range).
    const activity: ActivityItem[] =
      eventActivity.length > 0
        ? eventActivity
        : perMarket
            .filter((m) => m.investedPrincipal > 0 || m.yieldEarned > 0)
            .map((m) => ({
              type: "invested" as const,
              marketId: m.id,
              question: questionMap.get(m.id) ?? `Market #${m.id}`,
              usdcAmount: m.investedPrincipal,
              usycShares: m.usycShares,
              yieldEarned: m.yieldEarned,
              txHash: "",
              blockNumber: 0,
            }));

    const result: YieldChainResponse = {
      contractUsdc: Number(formatUnits(contractUsdcRaw, 6)),
      contractUsyc: Number(formatUnits(contractUsycRaw, 6)),
      perMarket,
      activity,
    };

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "chain fetch failed" },
      { status: 500 }
    );
  }
}
