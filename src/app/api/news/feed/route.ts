import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase.from("news_items").select("*").order("scanned_at", { ascending: false }).limit(50);
    const country = request.nextUrl.searchParams.get("country");
    const category = request.nextUrl.searchParams.get("category");
    if (country) query = query.eq("country", country);
    if (category) query = query.eq("groq_category", category);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to fetch news feed" }, { status: 500 });
  }
}
