"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { publicConfig } from "@/lib/env";
import { ThemeToggle } from "./ThemeToggle";

const NAV_LINKS = [
  { href: "/markets",     label: "Markets" },
  { href: "/agent",       label: "Agent" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/bridge",      label: "Bridge" },
  { href: "/about",       label: "About" },
];

export function Header() {
  const pathname = usePathname();
  const { address } = useAccount();
  const [open, setOpen] = useState(false);

  const config = publicConfig();
  const walletConfigured = Boolean(config.arcRpc && config.arcChainId);
  const isAdmin = address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN_WALLET?.toLowerCase();

  const links = [...NAV_LINKS, ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : [])];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          {/* Logo */}
          <Link href="/" onClick={() => setOpen(false)} className="font-display text-3xl font-black tracking-wide text-[#f5a623]">
            Àgbà
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-semibold transition-colors ${
                  pathname === link.href ? "text-[#f5a623]" : "text-white/70 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop wallet + theme toggle + mobile hamburger */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden md:block">
              {walletConfigured ? (
                <WalletButton />
              ) : (
                <span className="border border-white/10 px-3 py-2 text-xs font-bold text-white/45">Wallet env missing</span>
              )}
            </div>

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setOpen(true)}
              className="flex flex-col items-center justify-center gap-[5px] p-2 md:hidden"
              aria-label="Open menu"
            >
              <span className="block h-0.5 w-6 bg-white" />
              <span className="block h-0.5 w-6 bg-white" />
              <span className="block h-0.5 w-6 bg-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          {/* Top row */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
            <Link href="/" onClick={() => setOpen(false)} className="font-display text-3xl font-black tracking-wide text-[#f5a623]">
              Àgbà
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="p-2 text-white/60 hover:text-white"
              aria-label="Close menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex flex-1 flex-col gap-1 px-4 py-8">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`border-b border-white/5 py-5 font-display text-4xl font-black tracking-tight transition-colors ${
                  pathname === link.href ? "text-[#f5a623]" : "text-white hover:text-[#f5a623]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Wallet at bottom */}
          <div className="border-t border-white/10 px-4 py-6">
            {walletConfigured ? (
              <WalletButton fullWidth />
            ) : (
              <span className="text-sm text-white/45">Wallet env missing</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Injected wallet button ────────────────────────────────────────────────────
function WalletButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [menuOpen, setMenuOpen] = useState(false);
  const [connectError, setConnectError] = useState("");

  const injectedConnector = connectors.find((c) => c.type === "injected");

  async function handleConnect() {
    setConnectError("");
    if (!injectedConnector) {
      setConnectError("No injected wallet found. Install MetaMask.");
      return;
    }
    try {
      connect({ connector: injectedConnector });
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Connection failed");
    }
  }

  if (!isConnected) {
    return (
      <div className={fullWidth ? "w-full" : undefined}>
        <button
          onClick={handleConnect}
          disabled={isPending}
          className={`bg-[#f5a623] px-4 py-2 text-sm font-black text-black transition-opacity hover:opacity-90 disabled:opacity-50 ${fullWidth ? "w-full" : ""}`}
        >
          {isPending ? "Connecting…" : "Connect Wallet"}
        </button>
        {connectError && (
          <p className="mt-2 text-xs text-red-300">{connectError}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${fullWidth ? "w-full" : ""}`}>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className={`border border-white/20 px-3 py-2 font-mono text-xs font-bold text-white transition-colors hover:border-[#f5a623] hover:text-[#f5a623] ${fullWidth ? "w-full text-left" : ""}`}
      >
        {address?.slice(0, 6)}…{address?.slice(-4)}
      </button>
      {menuOpen && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className={`absolute z-50 mt-1 border border-white/10 bg-black py-1 shadow-lg ${fullWidth ? "w-full" : "right-0 w-40"}`}>
            <button
              onClick={() => { disconnect(); setMenuOpen(false); }}
              className="w-full px-4 py-2 text-left text-sm text-red-300 hover:bg-white/5"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
