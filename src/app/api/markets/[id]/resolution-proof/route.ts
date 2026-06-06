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
      .select(
        "id,resolution_mode,resolution_source_url,genlayer_creator_tx,genlayer_resolver_tx,genlayer_status,genlayer_creation_reasoning,genlayer_resolution_reasoning,genlayer_resolution_evidence,genlayer_resolution_source_used,resolves_at_reason",
      )
      .eq("id", id)
      .single();
    if (error) throw error;
    return safeJson({ proof: data });
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unable to fetch resolution proof" }, { status: 500 });
  }
}
