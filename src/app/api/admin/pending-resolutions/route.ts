import { NextResponse, type NextRequest } from "next/server";
import { assertAdminRequest } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertAdminRequest(request);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pending_resolution")
      .select("*, markets(*)")
      .eq("resolved", false)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ pending: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch pending resolutions";
    return NextResponse.json({ error: message }, { status: message.startsWith("Unauthorized") ? 401 : 500 });
  }
}
