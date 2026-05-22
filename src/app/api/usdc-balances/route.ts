import { Contract, JsonRpcProvider, formatUnits, getAddress, isAddress } from "ethers";
import { type NextRequest } from "next/server";
import { safeJson } from "@/lib/json";
import { USDC_NETWORKS } from "@/lib/usdcNetworks";

export const dynamic = "force-dynamic";

const ERC20_BALANCE_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;

export async function GET(request: NextRequest) {
  const walletInput = request.nextUrl.searchParams.get("wallet");
  if (!walletInput || !isAddress(walletInput)) {
    return safeJson({ error: "A valid wallet address is required." }, { status: 400 });
  }

  const wallet = getAddress(walletInput);
  const balances = await Promise.all(
    USDC_NETWORKS.map(async (network) => {
      try {
        const provider = new JsonRpcProvider(network.rpcUrl, network.chainId);
        const token = new Contract(network.usdcAddress, ERC20_BALANCE_ABI, provider);
        const [rawBalance, decimals] = await Promise.all([
          token.balanceOf(wallet) as Promise<bigint>,
          token.decimals() as Promise<bigint | number>,
        ]);
        const decimalCount = Number(decimals);
        const formatted = formatUnits(rawBalance, decimalCount);

        return {
          ...network,
          balance: formatted,
          rawBalance: rawBalance.toString(),
          decimals: decimalCount,
          status: "ok" as const,
        };
      } catch (error) {
        return {
          ...network,
          balance: "0",
          rawBalance: "0",
          decimals: 6,
          status: "error" as const,
          error: error instanceof Error ? error.message : "Unable to read balance",
        };
      }
    }),
  );

  const unifiedBalance = balances.reduce((total, item) => total + Number(item.balance || 0), 0);
  return safeJson({
    wallet,
    balances,
    unifiedBalance: formatDisplayAmount(unifiedBalance),
  });
}

function formatDisplayAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 6,
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
  });
}
