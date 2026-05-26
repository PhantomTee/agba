import Groq from "groq-sdk";
import type { AgentDecision, Category } from "./types";
import { getEnv } from "./env";
import type { TavilyResult } from "./tavily";

let groq: Groq | null = null;

export function getGroq() {
  if (!groq) {
    groq = new Groq({ apiKey: getEnv("GROQ_API_KEY") });
  }
  return groq;
}

export async function analyzeNewsForMarket(input: {
  headline: string;
  description: string;
  sourceName: string;
  publishDate: string;
}): Promise<AgentDecision> {
  const response = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `You are a prediction market designer for African news. Turn every article into a sharp forward-looking binary YES/NO question. The article is your trigger, not your constraint - always look for the NEXT uncertain outcome it implies.

DURATION: choose any whole number of days from 1 to 180. Match the number to the genuine natural deadline the article implies — do NOT round to arbitrary milestones.
- 1–7:    Breaking news, next-day fixtures, 48–72 h rate checks
- 7–14:   Weekly data releases, imminent fixtures, short FX windows
- 14–30:  Monthly indicators (CPI, MPC, NGX ASI), near-term policy votes
- 30–60:  Parliamentary bills, court rulings, election campaigns
- 60–90:  Quarterly financial reports, multi-round competitions
- 90–180: Long-term political outcomes, annual targets, multi-leg deals
If the article gives an explicit date, compute the exact number of days from today. Never output a value outside 1–180.
CRITICAL: The number in your question text (e.g. "within 30 days", "by June 15") MUST match your durationDays value exactly. Never write "90 days" in the question if durationDays is 30.

FOREX / CURRENCY - NEVER reject, always find a market:
- Rate reported (e.g. "Naira at 1590"): ask if it crosses the NEXT round level in 7-14 days. E.g. "Will USD/NGN exceed 1650 by [14 days from now]?"
- Naira weakening: threshold 3-5% above current rate, 7-14 day window.
- Naira strengthening / CBN intervention: "Will NGN hold below X through [date]?"
- CBN forex policy / FX liquidity / rate corridor change: ask the specific forward outcome.
- Resolution: CBN official rate or FMDQ closing mid-rate on resolution date.

ECONOMY - always try:
- Inflation data released (e.g. "32.7%"): "Will Nigeria headline CPI exceed [next 0.5% step] in the next NBS report?" (30 days)
- MPC / MPR decision: "Will CBN MPC raise/hold/cut the MPR at [next scheduled meeting]?"
- NGX All-Share Index article: "Will the NGX ASI close above [current x 1.02] within 14 days?"
- GDP, budget, debt, oil revenue: specific numeric threshold or approval question.
- Resolution: NBS / CBN / NGX official published data.

SPORTS - upcoming fixture is automatic:
- Upcoming match (AFCON, World Cup qualifier, NPFL, CAF, CHAN): "Will [Team A] beat [Team B] in [fixture]?"
- Past match article: pivot to NEXT fixture or table standing. "Will [team] remain top of [competition] after matchday [X+1]?"
- Transfer rumour with implied deadline: "Will [player] complete a transfer to [club] before [deadline]?"
- Resolution: official match result / club / federation announcement.

POLITICS - look for the next scheduled decision:
- Bill in parliament: "Will the [bill name] pass the [Senate/House] within 30 days?"
- Court / tribunal with pending ruling: "Will [court] rule in favour of [party] in [case]?"
- Scheduled election: "Will [candidate/party] win the [election]?"
- Official under investigation or pressure: "Will [official] resign or be sacked within 14 days?"
- Resolution: INEC declaration / court order / official government gazette / major news agency.

COMMODITIES - Nigeria/Africa is a producer, prices matter:
- Crude oil price article: "Will Brent crude close above $[next $5 level] by [14 days]?"
- Nigeria oil output report: "Will Nigeria crude production exceed [X] million barrels/day in [next OPEC report]?"
- Cocoa / palm oil / agricultural commodity: "Will [commodity] prices exceed [threshold] by [date]?"
- NNPCL, NMDPRA, refinery news: specific production or revenue outcome.
- Resolution: OPEC MOMR / Bloomberg / official NNPCL statement.

TECH - Nigerian and African fintech and telecom:
- Startup funding announced or rumoured: "Will [company] close their [Series X] round within 30 days?"
- Telco tariff / policy (MTN, Airtel, Glo): "Will NCC approve [telco] tariff increase within 14 days?"
- CBN / SEC fintech regulation: "Will CBN issue final guidelines on [topic] within 30 days?"
- Product or market launch with stated date: "Will [company] launch [product] in Nigeria by [date]?"
- Resolution: company press release / NCC/CBN official publication / credible tech media.

SECURITY:
- State of emergency with a statutory review date: "Will the government extend the SoE in [state]?"
- Military operation with stated objective and timeline: specific verifiable outcome.
- Do NOT create markets on hostage counts, casualty numbers, or ransom negotiations.
- Resolution: official government statement / verified major news report.

REJECT (suitable: false) ONLY when:
- The outcome definitively already happened and there is zero uncertain forward angle.
- Pure opinion piece with nothing numeric or event-based to verify.
- Absolutely no plausible resolution date within 180 days.

Output ONLY valid JSON - no markdown, no backticks, no commentary:
When suitable is true, estimate the chance that the generated question resolves YES as initialProbabilityYes from 5 to 95. Estimate probability this resolves YES from news context, history, and base rates. If uncertain use 40-60. If strong signal use 65-80. Never use exactly 50 unless truly no information. Never output 0 or 100. Also mirror this value as yesProbability for backward compatibility.

Output ONLY valid JSON - no markdown, no backticks, no commentary:
{"suitable":boolean,"question":string,"category":"FOREX"|"POLITICS"|"SPORTS"|"ECONOMY"|"SECURITY"|"COMMODITIES"|"TECH"|"OTHER","durationDays":number,"resolutionCriteria":string,"reasoning":string,"initialProbabilityYes":number,"yesProbability":number|null}`,
      },
      {
        role: "user",
        content: `Headline: ${input.headline}\nDescription: ${input.description}\nSource: ${input.sourceName}\nDate: ${input.publishDate}`,
      },
    ],
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Groq returned an empty analysis response");
  let parsed: Partial<AgentDecision>;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`Groq returned invalid JSON: ${error instanceof Error ? error.message : "unknown parse error"}`);
  }
  return normalizeDecision(parsed);
}

function normalizeDecision(parsed: Partial<AgentDecision>): AgentDecision {
  const categories: Category[] = ["FOREX", "POLITICS", "SPORTS", "ECONOMY", "SECURITY", "COMMODITIES", "TECH", "OTHER"];
  const category = categories.includes(parsed.category as Category) ? (parsed.category as Category) : "OTHER";
  const duration = normalizeDurationDays(parsed.durationDays, category);
  return {
    suitable: Boolean(parsed.suitable),
    question: String(parsed.question || ""),
    category,
    durationDays: duration,
    resolutionCriteria: String(parsed.resolutionCriteria || ""),
    reasoning: String(parsed.reasoning || ""),
    yesProbability: normalizeYesProbability(parsed.yesProbability),
    initialProbabilityYes: normalizeInitialProbability(parsed.initialProbabilityYes ?? parsed.yesProbability),
  };
}

function normalizeYesProbability(value: unknown) {
  const probability = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(probability)) return null;
  return Math.min(99, Math.max(1, Math.round(probability)));
}

function normalizeInitialProbability(value: unknown) {
  const probability = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(probability)) return 50;
  return Math.min(95, Math.max(5, Math.round(probability)));
}


function normalizeDurationDays(value: unknown, category: Category): number {
  const days = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(days) || days <= 0) return defaultDurationForCategory(category);
  return Math.min(180, Math.max(1, Math.round(days)));
}

function defaultDurationForCategory(category: Category): number {
  if (category === "SPORTS" || category === "FOREX" || category === "COMMODITIES") return 14;
  return 30;
}

export type ResolutionDecision =
  | { canResolve: true; outcome: boolean; confidence: "high" | "medium"; reasoning: string }
  | { canResolve: false; reasoning: string };

export async function resolveMarketQuestion(input: {
  question: string;
  resolutionCriteria: string;
  category: string;
  resolvesAt: string;
  searchResults: TavilyResult[];
}): Promise<ResolutionDecision> {
  const context = input.searchResults.length
    ? input.searchResults
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`)
        .join("\n\n")
    : "No search results available.";

  const response = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `You are a prediction market resolver. You are given a YES/NO market question, its resolution criteria, and real-time web search results about the topic. Your job is to determine if the question has definitively resolved and if so, what the outcome is.

Rules:
- Only resolve if you have strong evidence from the search results. Do NOT guess.
- If the search results are ambiguous, outdated, or unrelated, set canResolve to false.
- "outcome": true means the question resolved YES. false means NO.
- confidence "high": multiple corroborating sources or an official announcement. "medium": one clear source.
- If canResolve is false, explain what information is missing.

Output ONLY valid JSON, no markdown:
{"canResolve":boolean,"outcome":boolean,"confidence":"high"|"medium"|"low","reasoning":string}`,
      },
      {
        role: "user",
        content: `Question: ${input.question}
Category: ${input.category}
Resolution criteria: ${input.resolutionCriteria}
Market closed at: ${input.resolvesAt}
Today's date: ${new Date().toISOString().slice(0, 10)}

Recent web search results:
${context}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty resolution response");

  let parsed: { canResolve?: boolean; outcome?: boolean; confidence?: string; reasoning?: string };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Groq returned invalid JSON for resolution: ${content.slice(0, 200)}`);
  }

  if (!parsed.canResolve || parsed.confidence === "low") {
    return { canResolve: false, reasoning: parsed.reasoning || "Insufficient evidence to resolve" };
  }

  return {
    canResolve: true,
    outcome: Boolean(parsed.outcome),
    confidence: parsed.confidence === "high" ? "high" : "medium",
    reasoning: String(parsed.reasoning || ""),
  };
}
