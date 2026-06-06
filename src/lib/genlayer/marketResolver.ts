import { z } from "zod";
import { callGenLayer, type GenLayerResult } from "./client";

export const genLayerMarketResolverInputSchema = z.object({
  question: z.string().min(1),
  resolutionCriteria: z.string().min(1),
  resolutionSourceUrl: z.string().url(),
  resolvesAt: z.string().min(1),
});

export const genLayerResolutionSchema = z.object({
  outcome: z.enum(["YES", "NO", "UNKNOWN"]),
  confidence: z.number().min(0).max(100),
  evidence: z.string(),
  sourceUsed: z.string(),
  reasoning: z.string(),
});

export type GenLayerMarketResolverInput = z.infer<typeof genLayerMarketResolverInputSchema>;
export type GenLayerResolution = z.infer<typeof genLayerResolutionSchema>;

export async function requestGenLayerResolution(input: GenLayerMarketResolverInput): Promise<GenLayerResult<GenLayerResolution>> {
  const parsed = genLayerMarketResolverInputSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "ERROR", error: parsed.error.message };
  }

  return callGenLayer("MARKET_RESOLVER", "genlayer_requestMarketResolution", {
    ...parsed.data,
    rules: [
      "Resolve YES only if the named source clearly confirms the criteria.",
      "Resolve NO only if the named source clearly contradicts the criteria.",
      "Return UNKNOWN if the source is unreachable, blocked, ambiguous, paywalled, login-only, stale, or insufficient.",
      "Never guess.",
    ],
  }, validateGenLayerResolution);
}

export async function checkGenLayerResolution(txHash: string): Promise<GenLayerResult<GenLayerResolution>> {
  if (!txHash) return { status: "ERROR", error: "txHash is required" };
  return callGenLayer("MARKET_RESOLVER", "genlayer_checkMarketResolution", { txHash }, validateGenLayerResolution);
}

export function validateGenLayerResolution(value: unknown): GenLayerResolution {
  return genLayerResolutionSchema.parse(value);
}
