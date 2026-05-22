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
        content: `You are a prediction market designer for African news. Turn every article into a sharp forward-looking binary YES/NO question resolving in 7-30 days. The article is your trigger, not your constraint - always look for the NEXT uncertain outcome it implies.

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
- Absolutely no plausible resolution date within 30 days.

Output ONLY valid JSON - no markdown, no backticks, no commentary:
When suitable is true, estimate the chance that the generated question resolves YES as initialProbabilityYes from 0 to 100. Estimate probability (0-100) this resolves YES from news context, history, and base rates. If uncertain use 40-60. If strong signal use 65-80. Never use exactly 50 unless truly no information. Also mirror this value as yesProbability for backward compatibility.

Output ONLY valid JSON - no markdown, no backticks, no commentary:
{"suitable":boolean,"question":string,"category":"FOREX"|"POLITICS"|"SPORTS"|"ECONOMY"|"SECURITY"|"COMMODITIES"|"TECH"|"OTHER","durationDays":7|14|30,"resolutionCriteria":string,"reasoning":string,"initialProbabilityYes":number,"yesProbability":number|null}`,
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
  const duration = parsed.durationDays === 7 || parsed.durationDays === 14 || parsed.durationDays === 30 ? parsed.durationDays : 14;
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
  return Math.min(100, Math.max(0, Math.round(probability)));
}
