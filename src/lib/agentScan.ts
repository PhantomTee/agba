import Parser from "rss-parser";
import { getMarketContract } from "@/lib/chain";
import { NEWS_SOURCES } from "@/lib/constants";
import { isGroqFallbackEnabled } from "@/lib/genlayer/client";
import {
  clampGenLayerDurationDays,
  requestGenLayerMarketProposal,
  type GenLayerMarketProposal,
} from "@/lib/genlayer/marketCreator";
import { analyzeNewsForMarket } from "@/lib/groq";
import { keywordOverlapRatio } from "@/lib/similarity";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { AgentDecision } from "@/lib/types";

type FeedItem = Parser.Item & { sourceName: string; country: string };

const RSS_TIMEOUT_MS = 4_000;
const SCAN_TIME_BUDGET_MS = 48_000;
const GROQ_ANALYSIS_TIMEOUT_MS = 12_000;
const MAX_ARTICLES_ANALYZED_PER_RUN = 8;
const MAX_MARKETS_PER_RUN = 2;

export async function runAgentScan() {
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
      const decision = await getMarketDecision(item, url);
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
      const normalizedDurationDays = clampGenLayerDurationDays(decision.durationDays);
      const tx = await contract["createMarket(string,string,string,string,string,uint256,uint256)"](
        decision.question,
        decision.category,
        item.country,
        item.title,
        url,
        normalizedDurationDays,
        decision.initialProbabilityYes,
      );
      const receipt = await tx.wait();
      const event = ((receipt?.logs as unknown[] | undefined) || [])
        .map((log: unknown) => {
          try {
            const parsed = contract.interface.parseLog(log as never);
            return parsed
              ? {
                  name: parsed.name,
                  marketId: parsed.args.marketId as bigint | number,
                }
              : undefined;
          } catch {
            return undefined;
          }
        })
        .find((parsed) => parsed?.name === "MarketCreated");
      if (!event?.marketId) {
        throw new Error("MarketCreated event missing from createMarket transaction");
      }
      const marketId = Number(event.marketId);
      const resolvesAt = new Date(Date.now() + normalizedDurationDays * 86_400_000).toISOString();
      const marketPayload = {
        id: marketId,
        question: decision.question,
        category: decision.category,
        country: item.country,
        news_item_id: inserted.id,
        resolution_criteria: decision.resolutionCriteria,
        groq_yes_probability: decision.groqYesProbability,
        initial_probability_yes: decision.initialProbabilityYes,
        yes_pool: 0,
        no_pool: 0,
        agent_seeded: false,
        usyc_invested: false,
        yield_earned: 0,
        resolves_at: resolvesAt,
        created_by: decision.createdBy,
        resolution_mode: decision.resolutionMode,
        resolution_source_url: decision.resolutionSourceUrl,
        duration_days: normalizedDurationDays,
        resolves_at_reason: decision.resolvesAtReason,
        genlayer_creator_tx: decision.genlayerCreatorTx,
        genlayer_status: decision.createdBy === "GENLAYER" ? "CREATED" : "NOT_REQUESTED",
        genlayer_creation_reasoning: decision.createdBy === "GENLAYER" ? decision.reasoning : null,
      };
      const { error: marketError } = await supabase.from("markets").upsert(marketPayload, { onConflict: "id" });
      if (marketError && isMissingOptionalMarketColumnError(marketError)) {
        const legacyMarketPayload = stripOptionalMarketColumns(marketPayload);
        const { error: legacyMarketError } = await supabase.from("markets").upsert(legacyMarketPayload, { onConflict: "id" });
        if (legacyMarketError) throw legacyMarketError;
      } else if (marketError) {
        throw marketError;
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
  return {
    articlesScanned,
    articlesAnalyzed,
    marketsCreated,
    rejected,
    timedOut: isNearScanDeadline(scanStartedAt),
    lastError,
  };
}

type NormalizedMarketDecision = {
  suitable: boolean;
  question: string;
  category: AgentDecision["category"];
  durationDays: number;
  resolutionCriteria: string;
  reasoning: string;
  initialProbabilityYes: number;
  groqYesProbability: number | null;
  createdBy: "GENLAYER" | "GROQ";
  resolutionMode: "GENLAYER" | "LEGACY";
  resolutionSourceUrl: string | null;
  resolvesAtReason: string | null;
  genlayerCreatorTx: string | null;
};

async function getMarketDecision(item: FeedItem, url: string): Promise<NormalizedMarketDecision> {
  const genLayerResult = await requestGenLayerMarketProposal({
    title: item.title || "",
    summary: item.contentSnippet || item.content || "",
    sourceUrl: url,
    categoryHint: item.categories?.join(", "),
    publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
  });

  if (genLayerResult.status === "READY") {
    return normalizeGenLayerProposal(genLayerResult.output, genLayerResult.txHash);
  }

  if (genLayerResult.status === "REQUESTED") {
    throw new Error(`GenLayer market proposal requested but not ready: ${genLayerResult.txHash}`);
  }

  if (genLayerResult.status === "NOT_CONFIGURED" && isGroqFallbackEnabled()) {
    const fallback = await withTimeout(
      analyzeNewsForMarket({
        headline: item.title || "",
        description: item.contentSnippet || item.content || "",
        sourceName: item.sourceName,
        publishDate: item.isoDate || item.pubDate || new Date().toISOString(),
      }),
      GROQ_ANALYSIS_TIMEOUT_MS,
      "Groq analysis timed out",
    );
    return normalizeGroqFallback(fallback, url);
  }

  if (genLayerResult.status === "NOT_CONFIGURED") {
    return {
      suitable: false,
      question: "",
      category: "OTHER",
      durationDays: 7,
      resolutionCriteria: "",
      reasoning: genLayerResult.reason,
      initialProbabilityYes: 50,
      groqYesProbability: null,
      createdBy: "GENLAYER",
      resolutionMode: "GENLAYER",
      resolutionSourceUrl: url,
      resolvesAtReason: null,
      genlayerCreatorTx: null,
    };
  }

  throw new Error(genLayerResult.error);
}

function normalizeGenLayerProposal(proposal: GenLayerMarketProposal, txHash?: string): NormalizedMarketDecision {
  return {
    suitable: proposal.suitable,
    question: proposal.question,
    category: proposal.category,
    durationDays: proposal.durationDays,
    resolutionCriteria: proposal.resolutionCriteria,
    reasoning: proposal.reasoning,
    initialProbabilityYes: proposal.initialProbabilityYes,
    groqYesProbability: null,
    createdBy: "GENLAYER",
    resolutionMode: "GENLAYER",
    resolutionSourceUrl: proposal.resolutionSourceUrl,
    resolvesAtReason: proposal.resolvesAtReason,
    genlayerCreatorTx: txHash || null,
  };
}

function normalizeGroqFallback(decision: AgentDecision, sourceUrl: string): NormalizedMarketDecision {
  if (decision.category === "OTHER") {
    return {
      suitable: false,
      question: decision.question,
      category: "OTHER",
      durationDays: decision.durationDays,
      resolutionCriteria: decision.resolutionCriteria,
      reasoning: decision.reasoning,
      initialProbabilityYes: decision.initialProbabilityYes,
      groqYesProbability: decision.yesProbability,
      createdBy: "GROQ",
      resolutionMode: "LEGACY",
      resolutionSourceUrl: sourceUrl,
      resolvesAtReason: "Groq fallback did not provide a GenLayer resolution window reason.",
      genlayerCreatorTx: null,
    };
  }

  return {
    suitable: decision.suitable,
    question: decision.question,
    category: decision.category,
    durationDays: decision.durationDays,
    resolutionCriteria: decision.resolutionCriteria,
    reasoning: decision.reasoning,
    initialProbabilityYes: decision.initialProbabilityYes,
    groqYesProbability: decision.yesProbability,
    createdBy: "GROQ",
    resolutionMode: "LEGACY",
    resolutionSourceUrl: sourceUrl,
    resolvesAtReason: "Groq fallback market; resolution window from Groq durationDays.",
    genlayerCreatorTx: null,
  };
}

function isMissingColumnError(error: { code?: string; message?: string }, column: string) {
  return error.code === "PGRST204" || Boolean(error.message?.includes(column) && error.message.toLowerCase().includes("column"));
}

function isMissingOptionalMarketColumnError(error: { code?: string; message?: string }) {
  return [
    "groq_yes_probability",
    "initial_probability_yes",
    "agent_seeded",
    "usyc_invested",
    "yield_earned",
    "created_by",
    "resolution_mode",
    "resolution_source_url",
    "duration_days",
    "resolves_at_reason",
    "genlayer_creator_tx",
    "genlayer_status",
    "genlayer_creation_reasoning",
  ].some((column) => isMissingColumnError(error, column));
}

function stripOptionalMarketColumns<T extends Record<string, unknown>>(payload: T) {
  const legacyPayload = { ...payload };
  for (const column of [
    "groq_yes_probability",
    "initial_probability_yes",
    "agent_seeded",
    "usyc_invested",
    "yield_earned",
    "created_by",
    "resolution_mode",
    "resolution_source_url",
    "duration_days",
    "resolves_at_reason",
    "genlayer_creator_tx",
    "genlayer_status",
    "genlayer_creation_reasoning",
  ]) {
    delete legacyPayload[column];
  }
  return legacyPayload;
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
