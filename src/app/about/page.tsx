export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <p className="text-sm font-black uppercase tracking-[0.28em] text-[#f5a623]">Africa&apos;s prediction market</p>
      <h1 className="mt-4 font-display text-6xl font-black leading-none text-white">Agba turns African news into accountable markets.</h1>
      <div className="mt-10 space-y-6 text-lg leading-8 text-white/70">
        <p>
          Agba reads Nigerian and pan-African RSS sources, asks Groq to identify verifiable near-term outcomes, and posts suitable questions as
          USDC prediction markets on Arc testnet.
        </p>
        <p>
          Market outcomes are resolved server-side only. FOREX markets use live exchange-rate data; markets that require editorial judgment are
          placed in a manual resolution queue.
        </p>
        <p>
          The project is designed for the Agora Agents Hackathon and uses Arc, Circle USDC, Supabase Realtime, Groq, and Vercel Cron.
        </p>
      </div>
      <div className="mt-10 flex flex-wrap gap-3 text-sm font-bold">
        <a className="border border-white/10 px-4 py-3 text-white/70 hover:text-white" href="https://docs.arc.network" target="_blank" rel="noreferrer">
          Arc docs
        </a>
        <a className="border border-white/10 px-4 py-3 text-white/70 hover:text-white" href="https://developers.circle.com" target="_blank" rel="noreferrer">
          Circle docs
        </a>
      </div>
    </main>
  );
}
