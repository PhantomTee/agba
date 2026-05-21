"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase";
import type { NewsItem } from "@/lib/types";

export function ReadingRoom() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    // Load initial news via API
    fetch("/api/news/feed")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load AI reading room");
        if (active) setItems(data.items);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : "Unable to load AI reading room"))
      .finally(() => active && setLoading(false));

    // Supabase Realtime — silently skipped if env vars aren't available yet
    let cleanup: (() => void) | undefined;
    try {
      const supabase = getSupabaseBrowser();
      const channel = supabase
        .channel("ai-reading-room")
        .on("postgres_changes", { event: "*", schema: "public", table: "news_items" }, (payload) => {
          if (active) {
            setItems((current) =>
              [payload.new as NewsItem, ...current.filter((item) => item.id !== (payload.new as NewsItem).id)].slice(0, 50),
            );
          }
        })
        .subscribe();
      cleanup = () => supabase.removeChannel(channel);
    } catch {
      // Realtime unavailable — news still loads from API above
    }

    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  return (
    <aside className="lg:sticky lg:top-32 lg:h-[calc(100vh-9rem)]">
      <div className="border-l border-[#f5a623] pl-4">
        <h2 className="font-display text-3xl font-black text-white">AI Reading Room</h2>
        <p className="mt-1 text-sm text-white/50">Àgbà is reading Africa right now</p>
      </div>
      <div className="mt-6 space-y-5 overflow-y-auto pr-2 lg:max-h-[calc(100vh-15rem)]">
        {loading && <p className="text-sm text-white/50">Loading latest scanned articles...</p>}
        {error && <p className="border border-red-500/40 p-3 text-sm text-red-200">{error}</p>}
        {!loading && !error && items.length === 0 && <p className="text-sm text-white/50">No articles scanned yet.</p>}
        {items.map((item) => (
          <article key={item.id} className="border-b border-white/10 pb-4">
            <a href={item.url} target="_blank" rel="noreferrer" className="text-sm font-bold leading-snug text-white hover:text-[#f5a623]">
              {item.headline}
            </a>
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase ${item.market_created ? "text-[#f5a623]" : "text-white/35"}`}>
                {item.market_created ? "Became market" : "Passed"}
              </span>
              <span className="text-[10px] text-white/35">{item.source_name}</span>
            </div>
            {item.groq_reasoning && <p className="mt-2 text-xs leading-relaxed text-white/45">{item.groq_reasoning}</p>}
          </article>
        ))}
      </div>
    </aside>
  );
}
