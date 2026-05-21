import Groq from "groq-sdk";
import type { AgentDecision, Category } from "./types";
import { getEnv } from "./env";

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
        content: `You are a prediction market designer specialising in African news. Your job is to convert news articles into sharp, forward-looking binary (YES/NO) questions that resolve within 7–30 days.

FOREX / CURRENCY (highest priority — always try to create a market):
- Article reports today's NGN/USD rate (e.g. "Naira trades at ₦1,590"): ask whether it will CROSS THE NEXT PSYCHOLOGICAL LEVEL in 7–14 days. E.g. "Will USD/NGN exceed ₦1,650 by [date 14 days out]?"
- Article about naira weakening: set threshold ~3–5% above the reported rate, 7–14 day window.
- Article about naira strengthening / CBN intervention: ask if the gain holds below a threshold.
- Article about CBN forex policy, official rate corridor, or FX supply: ask a specific outcome question.
- Resolution criteria: "CBN official rate or FMDQ closing rate on the resolution date."
- NEVER reject a forex article. Every NGN exchange rate article can become a binary market.

ECONOMY:
- MPC meeting / interest rate decision: "Will CBN MPC hold/raise/cut the MPR at [month] meeting?"
- Inflation data due: "Will Nigeria's headline inflation exceed X% in [month]?"
- GDP, budget, bond yields: specific numeric threshold questions.
- Resolution: official government/NBS published data.

SPORTS:
- Upcoming match or qualifier (AFCON, World Cup, NPFL, CAF): "Will [team A] beat [team B] in [fixture]?"
- Transfer rumour with a deadline: "Will [player] complete a transfer to [club] by [deadline]?"
- Resolution: official match result / club announcement.

POLITICS:
- Scheduled election / governorship: "Will [candidate/party] win [election]?"
- Upcoming court ruling: "Will [court] rule in favour of [party] in [case]?"
- Policy decision pending: specific measurable outcome.
- Resolution: INEC declaration / court order / official gazette.

SECURITY:
- Ceasefire negotiations, hostage release, military operation with stated deadline.
- Only if there is a clear verifiable binary outcome within 30 days.

REJECT (suitable: false) if:
- The outcome already happened and there is NO uncertain future angle.
- Pure opinion / sentiment piece with nothing verifiable.
- No conceivable resolution date within 30 days.

Output ONLY valid JSON, no markdown, no backticks:
{"suitable":boolean,"question":string,"category":"FOREX"|"POLITICS"|"SPORTS"|"ECONOMY"|"SECURITY"|"OTHER","durationDays":7|14|30,"resolutionCriteria":string,"reasoning":string}`,
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
  const categories: Category[] = ["FOREX", "POLITICS", "SPORTS", "ECONOMY", "SECURITY", "OTHER"];
  const category = categories.includes(parsed.category as Category) ? (parsed.category as Category) : "OTHER";
  const duration = parsed.durationDays === 7 || parsed.durationDays === 14 || parsed.durationDays === 30 ? parsed.durationDays : 14;
  return {
    suitable: Boolean(parsed.suitable),
    question: String(parsed.question || ""),
    category,
    durationDays: duration,
    resolutionCriteria: String(parsed.resolutionCriteria || ""),
    reasoning: String(parsed.reasoning || ""),
  };
}
