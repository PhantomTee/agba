import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv, getOptionalEnv } from "./env";

let serviceClient: SupabaseClient | null = null;
let browserClient: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!serviceClient) {
    serviceClient = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_KEY"), {
      auth: { persistSession: false },
    });
  }
  return serviceClient;
}

export function getSupabaseBrowser() {
  if (!browserClient) {
    const url = getOptionalEnv("NEXT_PUBLIC_SUPABASE_URL") || getOptionalEnv("SUPABASE_URL");
    const anonKey = getOptionalEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (!url || !anonKey) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    browserClient = createClient(url, anonKey);
  }
  return browserClient;
}
