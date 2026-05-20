import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pending_resolution")
      .select("id,market_id,created_at,markets(id,question,category,country,resolves_at)")
      .eq("resolved", false)
      .order("created_at", { ascending: true })
      .limit(20);
    if (error) throw error;
    return NextResponse.json({ pending: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch pending resolutions" },
      { status: 500 },
    );
  }
}
