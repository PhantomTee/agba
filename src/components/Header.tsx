"use client";

import { ConnectKitButton } from "connectkit";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { CATEGORIES } from "@/lib/constants";
import { publicConfig } from "@/lib/env";

export function Header() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address } = useAccount();
  const active = searchParams.get("category") || "ALL";
  const config = publicConfig();
  const walletConfigured = Boolean(config.arcRpc && config.arcChainId && process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID);
  const isAdmin = address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN_WALLET?.toLowerCase();
  function setCategory(category: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (category === "ALL") params.delete("category");
    else params.set("category", category);
    router.push(`/?${params.toString()}`);
  }
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080808]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4">
        <Link href="/" className="font-display text-3xl font-black tracking-wide text-[#f5a623]">
          AGBA
        </Link>
        <nav className="flex flex-1 flex-wrap gap-2">
          {["ALL", ...CATEGORIES].map((category) => (
            <button
              key={category}
              onClick={() => setCategory(category)}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${active === category ? "border-[#f5a623] bg-[#f5a623] text-black" : "border-white/15 text-white/75 hover:border-white/40"}`}
            >
              {category}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/agent" className="text-sm font-semibold text-white/70 hover:text-white">
            Agent
          </Link>
          <Link href="/leaderboard" className="text-sm font-semibold text-white/70 hover:text-white">
            Leaderboard
          </Link>
          <Link href="/bridge" className="text-sm font-semibold text-white/70 hover:text-white">
            Bridge
          </Link>
          {isAdmin && (
            <Link href="/admin" className="text-sm font-semibold text-white/30 hover:text-white/70">
              Admin
            </Link>
          )}
          {walletConfigured ? (
            <ConnectKitButton />
          ) : (
            <span className="border border-white/10 px-3 py-2 text-xs font-bold text-white/45">Wallet env missing</span>
          )}
        </div>
      </div>
    </header>
  );
}
