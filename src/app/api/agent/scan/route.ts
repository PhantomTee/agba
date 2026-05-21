import Parser from "rss-parser";
import { NextResponse, type NextRequest } from "next/server";
import { assertCronRequest } from "@/lib/auth";
import { getMarketContract } from "@/lib/chain";
import { NEWS_SOURCES } from "@/lib/constants";
import { analyzeNewsForMarket } from "@/lib/groq";
import { keywordOverlapRatio } from "@/lib/similarity";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type FeedItem = Parser.Item & { sourceName: string; country: string };

export async function POST(request: NextRequest) {
  try {
    assertCronRequest(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized cron request" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();

  // Clean up news items that were never used to create a market and are older than 6 hours
  await supabase
    .from("news_items")
    .delete()
    .eq("market_created", false)
    .lt("scanned_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());

  const parser = new Parser();
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
      const tx = await contract.createMarket(
        decision.question,
        decision.category,
        item.country,
        item.title,
        url,
        decision.durationDays,
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
      const marketId = event?.args?.marketId ? Number(event.args.marketId) : Number(await contract.marketCount());
      const resolvesAt = new Date(Date.now() + decision.durationDays * 86_400_000).toISOString();
      const { error: marketError } = await supabase.from("markets").insert({
        id: marketId,
        question: decision.question,
        category: decision.category,
        country: item.country,
        news_item_id: inserted.id,
        resolution_criteria: decision.resolutionCriteria,
        resolves_at: resolvesAt,
      });
      if (marketError) throw marketError;
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
      const { error: reasonError } = await supabase
        .from("news_items")
        .update({ groq_reasoning: error instanceof Error ? error.message : "Agent scan failed" })
        .eq("id", inserted.id);
      if (reasonError) throw reasonError;
    }
  }
  return NextResponse.json({ articlesScanned, marketsCreated, rejected });
}
