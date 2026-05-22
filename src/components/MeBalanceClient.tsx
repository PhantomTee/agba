"use client";

import { useAccount } from "wagmi";
import { useUsdcBalances } from "@/hooks/useUsdcBalances";

export function MeBalanceClient() {
  const { address, isConnected } = useAccount();
  const { balances, unifiedBalance, loading, refreshing, error, refetch } = useUsdcBalances(address, isConnected);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="border-b border-white/10 pb-8 md:flex md:items-end md:justify-between md:gap-6">
        <div>
          <p className="mb-2 text-sm font-black uppercase tracking-[0.28em] text-[#f5a623]">Wallet</p>
          <h1 className="font-display text-5xl font-black leading-none text-white md:text-6xl">Me</h1>
          <p className="mt-3 text-sm text-white/45">
            {isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connect your wallet to see USDC balances."}
          </p>
        </div>
        <button
          onClick={() => refetch(false)}
          disabled={!isConnected || refreshing}
          className="mt-5 border border-white/15 px-4 py-2 text-sm font-black text-white/70 hover:border-[#f5a623] hover:text-[#f5a623] disabled:cursor-not-allowed disabled:opacity-50 md:mt-0"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {!isConnected && (
        <p className="py-16 text-white/45">Connect your wallet from the header to load your USDC balances across supported testnets.</p>
      )}

      {isConnected && (
        <>
          <section className="mt-8 border border-[#f5a623]/30 bg-[#f5a623]/5 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f5a623]/70">Unified USDC balance</p>
            <p className="mt-3 font-display text-5xl font-black leading-none text-white">
              {loading ? "..." : unifiedBalance} <span className="text-[#f5a623]">USDC</span>
            </p>
          </section>

          {error && <p className="mt-6 border border-red-500/40 p-4 text-sm text-red-200">{error}</p>}

          <section className="mt-8 grid gap-4 md:grid-cols-2">
            {balances.map((balance) => (
              <article key={balance.id} className="border border-white/10 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-white">{balance.label}</h2>
                    <p className="mt-1 font-mono text-xs text-white/35">{balance.usdcAddress.slice(0, 6)}...{balance.usdcAddress.slice(-4)}</p>
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-black uppercase ${balance.status === "ok" ? "bg-[#2d6a4f] text-white" : "bg-red-500/20 text-red-200"}`}>
                    {balance.status}
                  </span>
                </div>
                <p className="mt-5 text-3xl font-black text-white">
                  {formatBalance(balance.balance)} <span className="text-base text-white/45">USDC</span>
                </p>
                {balance.error && <p className="mt-3 text-xs text-red-200">{balance.error}</p>}
              </article>
            ))}
          </section>

          {!loading && balances.length === 0 && !error && (
            <p className="py-16 text-white/45">No balance data loaded yet.</p>
          )}
        </>
      )}
    </main>
  );
}

function formatBalance(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: 6,
    minimumFractionDigits: numeric > 0 && numeric < 1 ? 2 : 0,
  });
}
