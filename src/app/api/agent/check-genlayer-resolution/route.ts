import { type NextRequest } from "next/server";
import { assertXCronSecret, isUnauthorizedCronError } from "@/lib/genlayer/client";
import { checkGenLayerResolution } from "@/lib/genlayer/marketResolver";
import { safeJson } from "@/lib/json";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertXCronSecret(request);
    const body = await request.json().catch(() => ({}));
    const txHash = String(body.txHash || "");
    if (txHash) return safeJson(await checkGenLayerResolution(txHash));

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("markets")
      .select("id,question,genlayer_status,genlayer_resolver_tx,genlayer_resolution_reasoning")
      .eq("resolution_mode", "GENLAYER")
      .in("genlayer_status", ["REQUESTED", "UNRESOLVABLE", "ERROR", "NOT_CONFIGURED"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return safeJson({ pending: data || [] });
  } catch (error) {
    if (isUnauthorizedCronError(error)) return safeJson({ error: "Unauthorized cron request" }, { status: 401 });
    return safeJson({ error: error instanceof Error ? error.message : "Unable to check GenLayer resolution" }, { status: 500 });
  }
}
