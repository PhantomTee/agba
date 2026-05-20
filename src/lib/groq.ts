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
        content:
          "You are an African news analyst and prediction market designer. Given a news headline and description from Africa, determine: 1. Is this article suitable for a prediction market? It must have a binary outcome that can be verified in 7-30 days. 2. If yes, generate a precise prediction market question in English. 3. Suggest a resolution timeframe in days: exactly 7, 14, or 30. 4. Categorize as FOREX, POLITICS, SPORTS, ECONOMY, SECURITY, or OTHER. A good prediction market question has a clear YES/NO answer, can be verified by public data, resolves within 30 days, and is specific. Reject vague opinion questions. Respond ONLY in JSON, no markdown, no backticks, no explanation. Shape: {\"suitable\":boolean,\"question\":string,\"category\":string,\"durationDays\":number,\"resolutionCriteria\":string,\"reasoning\":string}",
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
