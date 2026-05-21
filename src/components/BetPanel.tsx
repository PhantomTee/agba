"use client";

import { BrowserProvider, Contract, MaxUint256, parseUnits, type Eip1193Provider } from "ethers";
import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ERC20_ABI, MARKET_ABI } from "@/lib/constants";
import { publicConfig } from "@/lib/env";
import { calculateOdds, formatUsdc } from "@/lib/odds";
import type { Market } from "@/lib/types";

export function BetPanel({ market, initialSide = true }: { market: Market; initialSide?: boolean }) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [amount, setAmount] = useState("");
  const [side, setSide] = useState<boolean>(initialSide);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const odds = calculateOdds(Number(market.yes_pool || 0), Number(market.no_pool || 0));
  const estimated = estimatePayout(Number(amount || "0"), side, Number(market.yes_pool || 0), Number(market.no_pool || 0));

  async function placeBet() {
    setError("");
    setStatus("");
    if (!isConnected || !address) {
      setError("Connect a wallet before betting.");
      return;
    }
    const config = publicConfig();
    if (!config.contractAddress || !config.usdcAddress) {
      setError("Contract and USDC addresses must be configured in environment variables.");
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid USDC amount.");
      return;
    }
    if (!walletClient) {
      setError("Wallet client not ready. Try reconnecting your wallet.");
      return;
    }
    setLoading(true);
    try {
      const provider = new BrowserProvider(walletClient as unknown as Eip1193Provider);
      const signer = await provider.getSigner();
      const amountUnits = parseUnits(amount, 6);
      const usdc = new Contract(config.usdcAddress, ERC20_ABI, signer);
      const marketContract = new Contract(config.contractAddress, MARKET_ABI, signer);
      const allowance = await usdc.allowance(address, config.contractAddress);
      if (allowance < amountUnits) {
        setStatus("Approving USDC...");
        const approveTx = await usdc.approve(config.contractAddress, MaxUint256);
        await approveTx.wait();
      }
      setStatus("Submitting bet to Arc...");
      const betTx = await marketContract.bet(market.id, side, amountUnits);
      const receipt = await betTx.wait();
      setStatus("Recording bet...");
      const response = await fetch("/api/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, side, amount: numericAmount, txHash: receipt.hash, walletAddress: address }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Bet transaction succeeded but recording failed");
      setStatus("Bet recorded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bet failed");
    } finally {
      setLoading(false);
    }
  }

  async function claimWinnings() {
    setError("");
    setStatus("");
    if (!isConnected || !address) {
      setError("Connect a wallet before claiming.");
      return;
    }
    const config = publicConfig();
    if (!config.contractAddress) {
      setError("Contract address must be configured in environment variables.");
      return;
    }
    if (!walletClient) {
      setError("Wallet client not ready. Try reconnecting your wallet.");
      return;
    }
    setClaiming(true);
    try {
      const provider = new BrowserProvider(walletClient as unknown as Eip1193Provider);
      const signer = await provider.getSigner();
      const marketContract = new Contract(config.contractAddress, MARKET_ABI, signer);
      setStatus("Claiming winnings on Arc...");
      const tx = await marketContract.claimWinnings(market.id);
      await tx.wait();
      setStatus("Claim completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="border border-white/10 bg-white/[0.03] p-5">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setSide(true)} className={`py-3 text-sm font-black ${side ? "bg-[#f5a623] text-black" : "bg-white/10 text-white"}`}>
          YES {odds.yesOdds}%
        </button>
        <button onClick={() => setSide(false)} className={`py-3 text-sm font-black ${!side ? "bg-[#2d6a4f] text-white" : "bg-white/10 text-white"}`}>
          NO {odds.noOdds}%
        </button>
      </div>
      <label className="mt-5 block text-xs font-black uppercase tracking-[0.2em] text-white/45">Amount USDC</label>
      <input
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        inputMode="decimal"
        className="mt-2 w-full border border-white/10 bg-black px-4 py-3 text-lg text-white outline-none focus:border-[#f5a623]"
        placeholder="0.00"
      />
      <p className="mt-3 text-sm text-white/55">Estimated payout if correct: USDC {formatUsdc(estimated)}</p>
      <button disabled={loading || market.resolved} onClick={placeBet} className="mt-5 w-full bg-[#f5a623] px-4 py-4 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50">
        {loading ? "Processing..." : market.resolved ? "Market resolved" : `Bet ${side ? "YES" : "NO"}`}
      </button>
      {market.resolved ? (
        <button disabled={claiming} onClick={claimWinnings} className="mt-3 w-full bg-[#2d6a4f] px-4 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
          {claiming ? "Claiming..." : "Claim winnings"}
        </button>
      ) : null}
      <a
        href="https://developers.circle.com/stablecoins/docs/cctp-getting-started"
        target="_blank"
        rel="noreferrer"
        className="mt-3 block border border-white/10 px-4 py-3 text-center text-xs font-bold text-white/70 hover:text-white"
      >
        Bridge USDC to Arc
      </a>
      {status && <p className="mt-3 text-sm text-[#f5a623]">{status}</p>}
      {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
    </div>
  );
}

function estimatePayout(amount: number, side: boolean, yesPool: number, noPool: number) {
  if (amount <= 0) return 0;
  const winningPool = side ? yesPool + amount : noPool + amount;
  const losingPool = side ? noPool : yesPool;
  if (winningPool <= 0) return amount;
  return amount + (amount / winningPool) * losingPool * 0.985;
}
