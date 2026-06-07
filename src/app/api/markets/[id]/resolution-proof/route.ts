import { type NextRequest } from "next/server";
import { safeJson } from "@/lib/json";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return safeJson({ error: "Invalid market id" }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("markets")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return safeJson({
      proof: {
        id: data.id,
        resolution_mode: data.resolution_mode ?? null,
        resolution_source_url: data.resolution_source_url ?? null,
        genlayer_creator_tx: data.genlayer_creator_tx ?? null,
        genlayer_resolver_tx: data.genlayer_resolver_tx ?? null,
        genlayer_status: data.genlayer_status ?? null,
        genlayer_creation_reasoning: data.genlayer_creation_reasoning ?? null,
        genlayer_resolution_reasoning: data.genlayer_resolution_reasoning ?? null,
        genlayer_resolution_evidence: data.genlayer_resolution_evidence ?? null,
        genlayer_resolution_source_used: data.genlayer_resolution_source_used ?? null,
        resolves_at_reason: data.resolves_at_reason ?? null,
      },
    });
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unable to fetch resolution proof" }, { status: 500 });
  }
}
