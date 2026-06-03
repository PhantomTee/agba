import { NextResponse, type NextRequest } from "next/server";
import { assertCronRequest } from "@/lib/auth";
import { getMarketContract } from "@/lib/chain";
import { getEnv, getOptionalEnv } from "@/lib/env";
import { resolveMarketQuestion } from "@/lib/groq";
import { getSupabaseAdmin } from "@/lib/supabase";
import { tavilySearch } from "@/lib/tavily";
import { completeUSYCRedemption } from "@/lib/agentYield";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    assertCronRequest(request);
    const supabase = getSupabaseAdmin();
    const { data: markets, error } = await supabase
      .from("markets")
      .select("*")
      .eq("resolved", false)
      .lt("resolves_at", new Date().toISOString());
    if (error) throw error;
    let resolved = 0;
    let pending = 0;
    for (const market of markets || []) {
      if (market.category === "FOREX") {
        try {
          const outcome = await resolveForexQuestion(market.question);
          await resolveOnchainAndDb(Number(market.id), outcome, "Resolved from exchangerate-api.com latest USD/NGN data");
          resolved += 1;
        } catch {
          await queueManualResolution(Number(market.id), market.question);
          pending += 1;
        }
      } else if (market.category === "SPORTS") {
        try {
          const sportsOutcome = await resolveSportsQuestion(market.question, market.resolves_at);
          if (sportsOutcome.resolved) {
            await resolveOnchainAndDb(Number(market.id), sportsOutcome.outcome, sportsOutcome.reasoning);
            resolved += 1;
          } else {
            await queueManualResolution(Number(market.id), market.question);
            pending += 1;
          }
        } catch {
          await queueManualResolution(Number(market.id), market.question);
          pending += 1;
        }
      } else {
        try {
          const searchQuery = buildSearchQuery(market.question, market.category, market.resolves_at);
          const searchResults = await tavilySearch(searchQuery, 5);
          const decision = await resolveMarketQuestion({
            question: market.question,
            resolutionCriteria: market.resolution_criteria || market.question,
            category: market.category,
            resolvesAt: market.resolves_at || new Date().toISOString(),
            searchResults,
          });
          if (decision.canResolve) {
            await resolveOnchainAndDb(Number(market.id), decision.outcome, decision.reasoning);
            resolved += 1;
          } else {
            await queueManualResolution(Number(market.id), market.question);
            pending += 1;
          }
        } catch {
          await queueManualResolution(Number(market.id), market.question);
          pending += 1;
        }
      }
    }
    return NextResponse.json({ checked: markets?.length || 0, resolved, pending });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to resolve markets" }, { status: 500 });
  }
}

async function resolveSportsQuestion(question: string, resolvesAt: string | null): Promise<{ resolved: true; outcome: boolean; reasoning: string } | { resolved: false }> {
  const token = getEnv("FOOTBALL_DATA_API_KEY");
  const end = resolvesAt ? new Date(resolvesAt) : new Date();
  const start = new Date(end.getTime() - 31 * 86_400_000);
  const url = new URL("https://api.football-data.org/v4/matches");
  url.searchParams.set("dateFrom", start.toISOString().slice(0, 10));
  url.searchParams.set("dateTo", end.toISOString().slice(0, 10));
  const response = await fetch(url, { headers: { "X-Auth-Token": token }, cache: "no-store" });
  if (!response.ok) throw new Error(`football-data.org failed with status ${response.status}`);
  const data = await response.json();
  const matches = Array.isArray(data.matches) ? data.matches : [];
  const questionLower = question.toLowerCase();
  const matched = matches.find((match: { homeTeam?: { name?: string }; awayTeam?: { name?: string }; score?: { winner?: string } }) => {
    const home = match.homeTeam?.name?.toLowerCase() || "";
    const away = match.awayTeam?.name?.toLowerCase() || "";
    return home && away && (questionLower.includes(home) || questionLower.includes(away));
  });
  if (!matched?.score?.winner || matched.score.winner === "DRAW") return { resolved: false };
  const homeName = matched.homeTeam?.name || "";
  const awayName = matched.awayTeam?.name || "";
  const asksHomeWin = questionLower.includes(homeName.toLowerCase()) && /\b(win|beat|defeat)\b/i.test(question);
  const asksAwayWin = questionLower.includes(awayName.toLowerCase()) && /\b(win|beat|defeat)\b/i.test(question);
  if (!asksHomeWin && !asksAwayWin) return { resolved: false };
  const homeWon = matched.score.winner === "HOME_TEAM";
  const outcome = asksHomeWin ? homeWon : !homeWon;
  return {
    resolved: true,
    outcome,
    reasoning: `Resolved from football-data.org match result: ${homeName} vs ${awayName}, winner=${matched.score.winner}`,
  };
}

async function resolveForexQuestion(question: string) {
  const key = getEnv("EXCHANGE_RATE_API_KEY");
  const response = await fetch(`https://v6.exchangerate-api.com/v6/${key}/latest/USD`, { cache: "no-store" });
  if (!response.ok) throw new Error(`ExchangeRate API failed with status ${response.status}`);
  const data = await response.json();
  const ngn = Number(data?.conversion_rates?.NGN);
  if (!Number.isFinite(ngn)) throw new Error("ExchangeRate API response did not include NGN");
  const threshold = extractNairaThreshold(question);
  if (!threshold) throw new Error("FOREX question did not include a numeric NGN threshold");
  const lowerTerms = ["below", "under", "less than"];
  const asksBelow = lowerTerms.some((term) => question.toLowerCase().includes(term));
  return asksBelow ? ngn < threshold : ngn > threshold;
}

function extractNairaThreshold(question: string) {
  const match = question.replace(/,/g, "").match(/(?:NGN|₦|Naira)?\s*(\d{3,5})(?:\s*\/\s*USD)?/i);
  return match ? Number(match[1]) : null;
}

async function resolveOnchainAndDb(marketId: number, outcome: boolean, reasoning: string) {
  const contract = getMarketContract();

  // Read USYC shares before resolving (contract clears them via completeRedemption later)
  const usycShares = await contract.getMarketUSYCBalance(marketId).catch(() => BigInt(0)) as bigint;

  const tx = await contract.resolveMarket(marketId, outcome);
  await tx.wait();

  // Complete USYC redemption off-chain: owner redeems via teller, pushes USDC back to contract
  let yieldEarned = 0;
  if (usycShares > BigInt(0)) {
    try {
      yieldEarned = await completeUSYCRedemption(contract, marketId, usycShares);
    } catch (e) {
      console.error("[resolve] USYC redemption failed for market", marketId, e instanceof Error ? e.message : e);
    }
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("markets")
    .update({ resolved: true, outcome, groq_resolution_reasoning: reasoning, yield_earned: yieldEarned })
    .eq("id", marketId);
  if (error) throw error;
}

async function notifyManualResolution(marketId: number, question: string) {
  const apiKey = getOptionalEnv("RESEND_API_KEY");
  const adminEmail = getOptionalEnv("ADMIN_EMAIL");
  if (!apiKey || !adminEmail) return;
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: "onboarding@resend.dev",
    to: adminEmail,
    subject: `Manual resolution required for Àgbà market #${marketId}`,
    text: `Question: ${question}`,
  });
}

async function queueManualResolution(marketId: number, question: string) {
  const supabase = getSupabaseAdmin();
  const { error: pendingError } = await supabase.from("pending_resolution").insert({ market_id: marketId });
  if (pendingError && pendingError.code !== "23505") throw pendingError;
  await notifyManualResolution(marketId, question);
}

function buildSearchQuery(question: string, category: string, resolvesAt: string | null): string {
  const year = resolvesAt ? new Date(resolvesAt).getFullYear() : new Date().getFullYear();
  const month = resolvesAt
    ? new Date(resolvesAt).toLocaleString("en-US", { month: "long" })
    : new Date().toLocaleString("en-US", { month: "long" });
  const categoryHints: Record<string, string> = {
    ECONOMY: "Nigeria economy official result",
    POLITICS: "Nigeria politics official announcement",
    TECH: "Nigeria tech announcement result",
    SECURITY: "Nigeria security official statement",
    COMMODITIES: "commodity price result",
  };
  const hint = categoryHints[category] || "Nigeria Africa result";
  return `${question} ${hint} ${month} ${year}`;
}
