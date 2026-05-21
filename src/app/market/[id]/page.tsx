import type { Metadata } from "next";
import { MarketDetailClient } from "@/components/MarketDetailClient";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = getSupabaseAdmin();
  const { data: market } = await supabase
    .from("markets")
    .select("question,category,country")
    .eq("id", Number(params.id))
    .single();

  if (!market) return { title: "Market not found" };

  const title = market.question;
  const description = `Bet YES or NO on this ${market.category} market from ${market.country || "Africa"}. Live on Àgbà.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function MarketPage({ params }: { params: { id: string } }) {
  return <MarketDetailClient id={params.id} />;
}
