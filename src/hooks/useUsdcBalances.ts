"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type UsdcBalance = {
  id: string;
  label: string;
  bridgeId: string;
  chainId: number;
  usdcAddress: string;
  balance: string;
  rawBalance: string;
  decimals: number;
  status: "ok" | "error";
  error?: string;
};

type BalanceResponse = {
  balances?: UsdcBalance[];
  unifiedBalance?: string;
  error?: string;
};

export function useUsdcBalances(wallet: string | undefined, enabled = true) {
  const [balances, setBalances] = useState<UsdcBalance[]>([]);
  const [unifiedBalance, setUnifiedBalance] = useState("0");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchBalances = useCallback((showLoading = false) => {
    if (!enabled || !wallet) {
      setBalances([]);
      setUnifiedBalance("0");
      setLoading(false);
      setRefreshing(false);
      setError("");
      return;
    }

    if (showLoading) setLoading(true);
    else setRefreshing(true);
    setError("");

    fetch(`/api/usdc-balances?wallet=${encodeURIComponent(wallet)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as BalanceResponse;
        if (!response.ok) throw new Error(data.error || "Unable to load USDC balances");
        setBalances(data.balances || []);
        setUnifiedBalance(data.unifiedBalance || "0");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load USDC balances"))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [enabled, wallet]);

  useEffect(() => {
    fetchBalances(true);
  }, [fetchBalances]);

  const balancesByBridgeId = useMemo(
    () => new Map(balances.map((balance) => [balance.bridgeId, balance])),
    [balances],
  );

  return {
    balances,
    balancesByBridgeId,
    unifiedBalance,
    loading,
    refreshing,
    error,
    refetch: fetchBalances,
  };
}
