import { type NextRequest } from "next/server";
import { getMarketContract } from "@/lib/chain";
import { assertXCronSecret } from "@/lib/genlayer/client";
import { clampGenLayerDurationDays, validateGenLayerMarketProposal } from "@/lib/genlayer/marketCreator";
import { safeJson } from "@/lib/json";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    assertXCronSecret(request);
    const body = await request.json();
    const proposal = validateGenLayerMarketProposal(body.proposal ?? body);
    if (!proposal.suitable) return safeJson({ error: "GenLayer proposal is not suitable" }, { status: 400 });

    const sourceUrl = String(body.sourceUrl || proposal.resolutionSourceUrl || "");
    if (!sourceUrl) return safeJson({ error: "sourceUrl is required" }, { status: 400 });

    const country = String(body.country || "AFRICA");
    const headline = String(body.headline || proposal.question);
    const newsItemId = typeof body.newsItemId === "string" ? body.newsItemId : null;
    const durationDays = clampGenLayerDurationDays(proposal.durationDays);
    const contract = getMarketContract();
    const tx = await contract["createMarket(string,string,string,string,string,uint256,uint256)"](
      proposal.question,
      proposal.category,
      country,
      headline,
      sourceUrl,
      durationDays,
      proposal.initialProbabilityYes,
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
    if (!event?.marketId) throw new Error("MarketCreated event missing from createMarket transaction");

    const marketId = Number(event.marketId);
    const resolvesAt = new Date(Date.now() + durationDays * 86_400_000).toISOString();
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("markets").upsert(
      {
        id: marketId,
        question: proposal.question,
        category: proposal.category,
        country,
        news_item_id: newsItemId,
        resolution_criteria: proposal.resolutionCriteria,
        initial_probability_yes: proposal.initialProbabilityYes,
        yes_pool: 0,
        no_pool: 0,
        agent_seeded: false,
        usyc_invested: false,
        yield_earned: 0,
        resolves_at: resolvesAt,
        created_by: "GENLAYER",
        resolution_mode: "GENLAYER",
        resolution_source_url: proposal.resolutionSourceUrl,
        duration_days: durationDays,
        resolves_at_reason: proposal.resolvesAtReason,
        genlayer_creator_tx: typeof body.genlayerCreatorTx === "string" ? body.genlayerCreatorTx : null,
        genlayer_status: "CREATED",
        genlayer_creation_reasoning: proposal.reasoning,
      },
      { onConflict: "id" },
    );
    if (error) throw error;

    return safeJson({ success: true, marketId, txHash: receipt?.hash || tx.hash });
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unable to create Arc market from GenLayer" }, { status: 500 });
  }
}
