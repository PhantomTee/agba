import { formatUnits } from "ethers";
import { type NextRequest } from "next/server";
import { getReadOnlyMarketContract } from "@/lib/chain";
import { safeJson } from "@/lib/json";
import { fetchMarkets } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams;
    const markets = await fetchMarkets({
      category: search.get("category"),
      country: search.get("country"),
      status: search.get("status"),
      limit: Number(search.get("limit") || "20"),
      offset: Number(search.get("offset") || "0"),
    });
    const wallet = search.get("wallet");
    const contract = getReadOnlyMarketContract();
    const enriched = await Promise.all(
      markets.map(async (market) => {
        const onchain = await contract.getMarket(market.id);
        const userBets = wallet ? await contract.getUserBets(market.id, wallet) : null;
        return {
          ...market,
          yes_pool: Number(formatUnits(onchain.yesPool, 6)),
          no_pool: Number(formatUnits(onchain.noPool, 6)),
          userBets: userBets
            ? { yes: formatUnits(userBets.yes, 6), no: formatUnits(userBets.no, 6) }
            : undefined,
        };
      }),
    );
    return safeJson({ markets: enriched });
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unable to fetch markets" }, { status: 500 });
  }
}
