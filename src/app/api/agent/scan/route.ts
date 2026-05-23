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

export async function POST(request: NextRequest) {
  try {
    assertCronRequest(request);
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unauthorized cron request" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();

  const parser = new Parser();
  // Cap market creation at 3 per run so we stay well within the 60-second limit.
  const MAX_MARKETS_PER_RUN = 3;
  let articlesScanned = 0;
  let marketsCreated = 0;
  let rejected = 0;
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
      const decision = await analyzeNewsForMarket({
        headline: item.title,
        description: item.contentSnippet || item.content || "",
        sourceName: item.sourceName,
        publishDate: item.isoDate || item.pubDate || new Date().toISOString(),
      });
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
      const { data: openMarkets, error: openError } = await supabase
        .from("markets")
        .select("question")
        .eq("resolved", false);
      if (openError) throw openError;
      const tooSimilar = (openMarkets || []).some((market) => keywordOverlapRatio(decision.question, market.question) > 0.5);
      if (tooSimilar) {
        rejected += 1;
        continue;
      }
      const contract = getMarketContract();
      await assertCompatibleMarketContract(contract);
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
      const { error: marketError } = await supabase.from("markets").insert(marketPayload);
      if (marketError && isMissingOptionalMarketColumnError(marketError)) {
        const { groq_yes_probability: _unusedGroq, initial_probability_yes: _unusedInitial, ...legacyMarketPayload } = marketPayload;
        const { error: legacyMarketError } = await supabase.from("markets").insert(legacyMarketPayload);
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
      if (marketsCreated >= MAX_MARKETS_PER_RUN) break;
    } catch (error) {
      rejected += 1;
      const { error: reasonError } = await supabase
        .from("news_items")
        .update({ groq_reasoning: error instanceof Error ? error.message : "Agent scan failed" })
        .eq("id", inserted.id);
      if (reasonError) throw reasonError;
    }
  }
  return safeJson({ articlesScanned, marketsCreated, rejected });
}

function isMissingColumnError(error: { code?: string; message?: string }, column: string) {
  return error.code === "PGRST204" || Boolean(error.message?.includes(column) && error.message.toLowerCase().includes("column"));
}

function isMissingOptionalMarketColumnError(error: { code?: string; message?: string }) {
  return ["groq_yes_probability", "initial_probability_yes", "agent_seeded", "usyc_invested"].some((column) => isMissingColumnError(error, column));
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
  } catch {
    throw new Error(
      `Configured NEXT_PUBLIC_CONTRACT_ADDRESS does not support the EURC/USYC market ABI. Update it to the latest deployed AgbaMarket address before scanning.`,
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
