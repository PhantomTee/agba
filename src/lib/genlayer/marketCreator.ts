import { z } from "zod";
import { callGenLayer, type GenLayerResult } from "./client";

export const genLayerMarketCreatorInputSchema = z.object({
  title: z.string().min(1),
  summary: z.string().default(""),
  sourceUrl: z.string().url(),
  categoryHint: z.string().optional(),
  publishedAt: z.string().optional(),
});

export const genLayerMarketProposalSchema = z.object({
  suitable: z.boolean(),
  question: z.string(),
  category: z.enum(["FOREX", "POLITICS", "SPORTS", "ECONOMY", "SECURITY", "COMMODITIES", "TECH"]),
  resolutionCriteria: z.string(),
  resolutionSourceUrl: z.string().url(),
  resolutionMode: z.literal("GENLAYER"),
  durationDays: z.number().int(),
  resolvesAtReason: z.string(),
  initialProbabilityYes: z.number().int().min(0).max(100),
  reasoning: z.string(),
});

export type GenLayerMarketCreatorInput = z.infer<typeof genLayerMarketCreatorInputSchema>;
export type GenLayerMarketProposal = z.infer<typeof genLayerMarketProposalSchema>;

export async function requestGenLayerMarketProposal(input: GenLayerMarketCreatorInput): Promise<GenLayerResult<GenLayerMarketProposal>> {
  const parsed = genLayerMarketCreatorInputSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "ERROR", error: parsed.error.message };
  }

  return callGenLayer("MARKET_CREATOR", "genlayer_requestMarketCreation", {
    ...parsed.data,
    rules: [
      "Reject if no source URL.",
      "Reject subjective markets.",
      "Reject if no clear future event or measurable claim.",
      "Reject if resolution depends on rumours, private info, pure opinion, or unclear sources.",
      "Question must be binary YES/NO.",
      "Resolution criteria must name the exact source and exact condition.",
      "durationDays must match the event type.",
      "initialProbabilityYes must be 0-100.",
      "If uncertain, use 40-60.",
      "Never use exactly 50 unless there is truly no useful signal.",
      "Breaking news: 1-3 days.",
      "Sports/scheduled match: event end + 1 day.",
      "Politics/election: 7-30 days.",
      "Economy/CBN/inflation/FX: 7-45 days.",
      "Commodities/oil/fuel: 7-30 days.",
      "Security/conflict: 3-14 days.",
      "Tech/company/product: 3-21 days.",
      "If no sensible resolution window exists, suitable=false.",
    ],
  }, validateGenLayerMarketProposal);
}

export async function checkGenLayerMarketProposal(txHash: string): Promise<GenLayerResult<GenLayerMarketProposal>> {
  if (!txHash) return { status: "ERROR", error: "txHash is required" };
  return callGenLayer("MARKET_CREATOR", "genlayer_checkMarketCreation", { txHash }, validateGenLayerMarketProposal);
}

export function validateGenLayerMarketProposal(value: unknown): GenLayerMarketProposal {
  return genLayerMarketProposalSchema.parse(value);
}

export function clampGenLayerDurationDays(durationDays: number) {
  if (!Number.isFinite(durationDays) || durationDays <= 0) return 7;
  return Math.min(45, Math.max(1, Math.round(durationDays)));
}
