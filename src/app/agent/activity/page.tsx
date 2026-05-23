import Link from "next/link";
import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "AI Agent Activity",
  description: "Autonomous article scans, decisions, and market creation activity from the Agba agent.",
};

export const dynamic = "force-dynamic";

type AgentItem = {
  id: string;
  headline: string;
  source_name: string | null;
  country: string | null;
  url: string;
  groq_suitable: boolean | null;
  groq_question: string | null;
  groq_category: string | null;
  groq_duration_days: number | null;
  groq_reasoning: string | null;
  market_created: boolean | null;
  scanned_at: string | null;
  markets?: Array<{ id: number; question: string; resolved: boolean }> | null;
};

export default async function AgentActivityPage() {
  const items = await fetchAgentActivity();
  const created = items.filter((item) => item.market_created).length;
  const rejected = items.filter((item) => item.groq_suitable === false || (!item.market_created && item.groq_reasoning)).length;
  const suitable = items.filter((item) => item.groq_suitable).length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="border-b border-white/10 pb-7">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f5a623]">Autonomous agent</p>
        <h1 className="mt-2 font-display text-5xl font-black leading-none text-white md:text-7xl">AI Decision Log</h1>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Metric label="Recent scans" value={String(items.length)} />
          <Metric label="Suitable" value={String(suitable)} />
          <Metric label="Markets created" value={String(created)} />
        </div>
      </div>

      <section className="mt-8 border-t border-white/10">
        {items.length === 0 ? <p className="py-12 text-white/45">No autonomous activity recorded yet.</p> : null}
        {items.map((item) => {
          const market = Array.isArray(item.markets) ? item.markets[0] : null;
          const status = item.market_created ? "Created market" : item.groq_suitable ? "Suitable, not created" : "Rejected";
          return (
            <article key={item.id} className="grid gap-4 border-b border-white/10 py-5 lg:grid-cols-[180px_minmax(0,1fr)_220px]">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
                  {item.scanned_at ? new Date(item.scanned_at).toLocaleString() : "Unknown time"}
                </div>
                <div className="mt-2 text-xs font-bold text-white/45">{item.source_name || "Unknown source"}</div>
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className={`px-2 py-1 text-xs font-black ${item.market_created ? "bg-[#2d6a4f] text-white" : "bg-white/10 text-white/60"}`}>
                    {status}
                  </span>
                  {item.groq_category && <span className="px-2 py-1 text-xs font-black text-black bg-[#f5a623]">{item.groq_category}</span>}
                  <span className="px-2 py-1 text-xs font-bold text-white/50">{item.country || "AFRICA"}</span>
                </div>
                <a href={item.url} target="_blank" rel="noreferrer" className="font-display text-2xl font-black leading-tight text-white hover:text-[#f5a623]">
                  {item.headline}
                </a>
                {item.groq_question && <p className="mt-3 text-sm font-bold text-white">{item.groq_question}</p>}
                {item.groq_reasoning && <p className="mt-2 text-sm leading-relaxed text-white/55">{item.groq_reasoning}</p>}
              </div>
              <div className="lg:text-right">
                {market ? (
                  <Link href={`/market/${market.id}`} className="inline-block border border-[#f5a623] px-4 py-2 text-sm font-black text-[#f5a623] hover:bg-[#f5a623] hover:text-black">
                    Market #{market.id}
                  </Link>
                ) : (
                  <span className="text-sm text-white/35">{rejected >= 0 ? "No market linked" : ""}</span>
                )}
                {item.groq_duration_days ? <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-white/35">{item.groq_duration_days} day window</p> : null}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

async function fetchAgentActivity(): Promise<AgentItem[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("news_items")
    .select("*, markets(id,question,resolved)")
    .order("scanned_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return (data || []) as AgentItem[];
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 p-4">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}
