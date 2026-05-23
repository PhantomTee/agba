import Parser from "rss-parser";
import { Contract, MaxUint256, formatUnits, parseUnits } from "ethers";
import { type NextRequest } from "next/server";
import { assertCronRequest } from "@/lib/auth";
import { getAgentWallet, getMarketContract } from "@/lib/chain";
import { ERC20_ABI, NEWS_SOURCES } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { analyzeNewsForMarket } from "@/lib/groq";
import { safeJson } from "@/lib/json";
import { keywordOverlapRatio } from "@/lib/similarity";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type FeedItem = Parser.Item & { sourceName: string; country: string };

const RSS_TIMEOUT_MS = 4_000;
const SCAN_TIME_BUDGET_MS = 48_000;
const GROQ_ANALYSIS_TIMEOUT_MS = 12_000;
const MAX_ARTICLES_ANALYZED_PER_RUN = 8;
const MAX_MARKETS_PER_RUN = 2;

export async function POST(request: NextRequest) {
  try {
    assertCronRequest(request);
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unauthorized cron request" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  const scanStartedAt = Date.now();

  const parser = new Parser({ timeout: RSS_TIMEOUT_MS });
  let articlesScanned = 0;
  let articlesAnalyzed = 0;
  let marketsCreated = 0;
  let rejected = 0;
  let lastError = "";
  const feedResults = await Promise.allSettled(
    NEWS_SOURCES.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.url);
        return (feed.items || []).slice(0, 3).map((item) => ({ ...item, sourceName: source.name, country: source.country }));
      } catch (error) {
        return [] as FeedItem[];
      }
    }),
  );
  const items = feedResults.flatMap((result) => (result.status === "fulfilled" ? result.value : []));

  for (const item of items) {
    if (marketsCreated >= MAX_MARKETS_PER_RUN || articlesAnalyzed >= MAX_ARTICLES_ANALYZED_PER_RUN || isNearScanDeadline(scanStartedAt)) break;
    const url = item.link || item.guid;
    if (!url || !item.title) continue;
    const { data: inserted, error: insertError } = await supabase
      .from("news_items")
      .insert({
        url,
        headline: item.title,
        description: item.contentSnippet || item.content || "",
        source_name: item.sourceName,
        country: item.country,
        published_at: item.isoDate || item.pubDate || null,
      })
      .select()
      .single();
    if (insertError) {
      if (insertError.code === "23505") continue;
      throw insertError;
    }
    articlesScanned += 1;
    try {
      articlesAnalyzed += 1;
      const decision = await withTimeout(
        analyzeNewsForMarket({
          headline: item.title,
          description: item.contentSnippet || item.content || "",
          sourceName: item.sourceName,
          publishDate: item.isoDate || item.pubDate || new Date().toISOString(),
        }),
        GROQ_ANALYSIS_TIMEOUT_MS,
        "Groq analysis timed out",
      );
      const { error: updateError } = await supabase
        .from("news_items")
        .update({
          groq_suitable: decision.suitable,
          groq_question: decision.question,
          groq_category: decision.category,
          groq_duration_days: decision.durationDays,
          groq_reasoning: decision.reasoning,
        })
        .eq("id", inserted.id);
      if (updateError) throw updateError;
      if (!decision.suitable || !decision.question || decision.category === "OTHER") {
        rejected += 1;
        continue;
      }
      const contract = getMarketContract();
      await assertCompatibleMarketContract(contract);
      const [{ data: openMarkets, error: openError }, currentMarketCount] = await Promise.all([
        supabase.from("markets").select("id,question").eq("resolved", false),
        contract.marketCount().then((count: bigint) => Number(count)),
      ]);
      if (openError) throw openError;
      const currentOpenMarkets = (openMarkets || []).filter((market) => Number(market.id) <= currentMarketCount);
      const tooSimilar = currentOpenMarkets.some((market) => keywordOverlapRatio(decision.question, market.question) > 0.5);
      if (tooSimilar) {
        rejected += 1;
        continue;
      }
      const tx = await contract["createMarket(string,string,string,string,string,uint256,uint256)"](
        decision.question,
        decision.category,
        item.country,
        item.title,
        url,
        decision.durationDays,
        decision.initialProbabilityYes,
      );
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log: unknown) => {
          try {
            return contract.interface.parseLog(log as never);
          } catch {
            return undefined;
          }
        })
        .find((parsed: { name?: string } | undefined) => parsed?.name === "MarketCreated");
      if (!event?.args?.marketId) {
        throw new Error("MarketCreated event missing from createMarket transaction");
      }
      const marketId = Number(event.args.marketId);
      const resolvesAt = new Date(Date.now() + decision.durationDays * 86_400_000).toISOString();
      const marketPayload = {
        id: marketId,
        question: decision.question,
        category: decision.category,
        country: item.country,
        news_item_id: inserted.id,
        resolution_criteria: decision.resolutionCriteria,
        groq_yes_probability: decision.yesProbability,
        initial_probability_yes: decision.initialProbabilityYes,
        resolves_at: resolvesAt,
      };
      const { error: marketError } = await supabase.from("markets").upsert(marketPayload, { onConflict: "id" });
      if (marketError && isMissingOptionalMarketColumnError(marketError)) {
        const { groq_yes_probability: _unusedGroq, initial_probability_yes: _unusedInitial, ...legacyMarketPayload } = marketPayload;
        const { error: legacyMarketError } = await supabase.from("markets").upsert(legacyMarketPayload, { onConflict: "id" });
        if (legacyMarketError) throw legacyMarketError;
      } else if (marketError) {
        throw marketError;
      }
      const seedResult = await seedMarketLiquidity(contract, marketId, decision.initialProbabilityYes);
      if (seedResult.seeded) {
        const { error: seedUpdateError } = await supabase
          .from("markets")
          .update({
            yes_pool: seedResult.yesPool,
            no_pool: seedResult.noPool,
            agent_seeded: true,
          })
          .eq("id", marketId);
        if (seedUpdateError && !isMissingOptionalMarketColumnError(seedUpdateError)) throw seedUpdateError;
      }
      const investResult = await investIdleUSYC(contract, marketId, seedResult.totalPool);
      if (investResult.invested) {
        const { error: investUpdateError } = await supabase
          .from("markets")
          .update({ usyc_invested: true })
          .eq("id", marketId);
        if (investUpdateError && !isMissingOptionalMarketColumnError(investUpdateError)) throw investUpdateError;
      }
      const { error: createdError } = await supabase.from("news_items").update({ market_created: true }).eq("id", inserted.id);
      if (createdError) throw createdError;
      await supabase.channel("new_market").send({
        type: "broadcast",
        event: "created",
        payload: { marketId, question: decision.question, category: decision.category, country: item.country },
      });
      marketsCreated += 1;
    } catch (error) {
      rejected += 1;
      lastError = error instanceof Error ? error.message : "Agent scan failed";
      const { error: reasonError } = await supabase
        .from("news_items")
        .update({ groq_reasoning: lastError })
        .eq("id", inserted.id);
      if (reasonError) throw reasonError;
    }
  }
  return safeJson({
    articlesScanned,
    articlesAnalyzed,
    marketsCreated,
    rejected,
    timedOut: isNearScanDeadline(scanStartedAt),
    contractAddress: getEnv("NEXT_PUBLIC_CONTRACT_ADDRESS"),
    lastError,
  });
}

function isMissingColumnError(error: { code?: string; message?: string }, column: string) {
  return error.code === "PGRST204" || Boolean(error.message?.includes(column) && error.message.toLowerCase().includes("column"));
}

function isMissingOptionalMarketColumnError(error: { code?: string; message?: string }) {
  return ["groq_yes_probability", "initial_probability_yes", "agent_seeded", "usyc_invested"].some((column) => isMissingColumnError(error, column));
}

function isNearScanDeadline(startedAt: number) {
  return Date.now() - startedAt > SCAN_TIME_BUDGET_MS;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

async function seedMarketLiquidity(contract: ReturnType<typeof getMarketContract>, marketId: number, probability: number) {
  try {
    const totalSeed = parseUnits("2", 6);
    const yesAmount = (totalSeed * BigInt(Math.floor(probability))) / BigInt(100);
    const noAmount = totalSeed - yesAmount;
    const usdc = new Contract(getEnv("NEXT_PUBLIC_USDC_ADDRESS"), ERC20_ABI, contract.runner);
    const spender = getEnv("NEXT_PUBLIC_CONTRACT_ADDRESS");
    const agentAddress = getAgentWallet().address;
    const allowance = await usdc.allowance(agentAddress, spender);
    if (allowance < totalSeed) {
      const approveTx = await usdc.approve(spender, MaxUint256);
      await approveTx.wait();
    }
    if (yesAmount > BigInt(0)) {
      const yesTx = await contract.bet(marketId, true, yesAmount);
      await yesTx.wait();
    }
    if (noAmount > BigInt(0)) {
      const noTx = await contract.bet(marketId, false, noAmount);
      await noTx.wait();
    }
    const onchain = await contract.getMarket(marketId);
    const yesPool = Number(formatUnits(onchain.yesPool, 6));
    const noPool = Number(formatUnits(onchain.noPool, 6));
    return { seeded: true, yesPool, noPool, totalPool: yesPool + noPool };
  } catch {
    return { seeded: false, yesPool: 0, noPool: 0, totalPool: 0 };
  }
}

async function assertCompatibleMarketContract(contract: ReturnType<typeof getMarketContract>) {
  try {
    await contract.eurcToken();
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` (${error.message})` : "";
    throw new Error(
      `Configured NEXT_PUBLIC_CONTRACT_ADDRESS does not support the EURC/USYC market ABI. Update it to the latest deployed AgbaMarket address before scanning.${detail}`,
    );
  }
}

async function investIdleUSYC(contract: ReturnType<typeof getMarketContract>, marketId: number, totalPool: number) {
  try {
    if (totalPool <= 10) return { invested: false };
    const investAmount = parseUnits(String(totalPool / 2), 6);
    const tx = await contract.investInUSYC(marketId, investAmount);
    await tx.wait();
    return { invested: true };
  } catch {
    return { invested: false };
  }
}
