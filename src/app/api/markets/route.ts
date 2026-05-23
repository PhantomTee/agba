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
        const [onchain, eurcPools, userBets, userEURCBets] = await Promise.all([
          contract.getMarket(market.id),
          contract.getEURCPools(market.id),
          wallet ? contract.getUserBets(market.id, wallet) : null,
          wallet ? contract.getUserEURCBets(market.id, wallet) : null,
        ]);
        if (Number(onchain.id) === 0) return null;
        return {
          ...market,
          question: onchain.question,
          category: onchain.category,
          country: onchain.sourceCountry,
          created_at: new Date(Number(onchain.createdAt) * 1000).toISOString(),
          resolves_at: new Date(Number(onchain.resolvesAt) * 1000).toISOString(),
          resolved: onchain.resolved,
          outcome: onchain.resolved ? onchain.outcome : null,
          news_items: market.news_items
            ? {
                ...market.news_items,
                headline: onchain.newsHeadline,
                url: onchain.newsUrl,
                country: onchain.sourceCountry,
              }
            : market.news_items,
          yes_pool: Number(formatUnits(onchain.yesPool, 6)),
          no_pool: Number(formatUnits(onchain.noPool, 6)),
          eurc_yes_pool: Number(formatUnits(eurcPools.yesPool, 6)),
          eurc_no_pool: Number(formatUnits(eurcPools.noPool, 6)),
          initial_probability_yes: Number(onchain.initialProbabilityYes ?? market.initial_probability_yes ?? 50),
          userBets: userBets
            ? { yes: formatUnits(userBets.yes, 6), no: formatUnits(userBets.no, 6) }
            : undefined,
          userEURCBets: userEURCBets
            ? { yes: formatUnits(userEURCBets.yes, 6), no: formatUnits(userEURCBets.no, 6) }
            : undefined,
        };
      }),
    );
    return safeJson({ markets: enriched.filter((market) => market !== null) });
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unable to fetch markets" }, { status: 500 });
  }
}
