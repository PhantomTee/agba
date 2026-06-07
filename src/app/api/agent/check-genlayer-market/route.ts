import { type NextRequest } from "next/server";
import { assertXCronSecret, isUnauthorizedCronError } from "@/lib/genlayer/client";
import { checkGenLayerMarketProposal } from "@/lib/genlayer/marketCreator";
import { safeJson } from "@/lib/json";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertXCronSecret(request);
    const body = await request.json().catch(() => ({}));
    const txHash = String(body.txHash || "");
    if (!txHash) return safeJson({ error: "txHash is required" }, { status: 400 });
    return safeJson(await checkGenLayerMarketProposal(txHash));
  } catch (error) {
    if (isUnauthorizedCronError(error)) return safeJson({ error: "Unauthorized cron request" }, { status: 401 });
    return safeJson({ error: error instanceof Error ? error.message : "Unable to check GenLayer market" }, { status: 500 });
  }
}
