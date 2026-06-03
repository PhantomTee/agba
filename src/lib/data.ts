import { getSupabaseAdmin } from "./supabase";
import type { Market } from "./types";

export async function fetchMarkets(params: {
  category?: string | null;
  country?: string | null;
  status?: string | null;
  limit?: number;
  offset?: number;
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("markets")
    .select("*, news_items(*)")
    .order("created_at", { ascending: false })
    .range(params.offset || 0, (params.offset || 0) + (params.limit || 20) - 1);

  if (params.category && params.category !== "ALL") query = query.eq("category", params.category);
  if (params.country) query = query.eq("country", params.country);
  if (params.status === "open") query = query.is("resolved", false);
  if (params.status === "resolved") query = query.is("resolved", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Market[];
}
