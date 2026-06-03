"use client";

import { useEffect, useRef, useState } from "react";

type MarketYieldEntry = {
  id: number;
  investedPrincipal: number;
  usycShares: number;
  unrealizedYield: number;
  currentValueUsdc: number;
};

type YieldMap = Map<number, MarketYieldEntry>;

const POLL_MS = 30_000;

let _cache: YieldMap | null = null;
let _lastFetch = 0;
let _inflight: Promise<YieldMap> | null = null;

async function fetchYieldMap(): Promise<YieldMap> {
  if (_inflight) return _inflight;
  if (_cache && Date.now() - _lastFetch < POLL_MS) return _cache;

  _inflight = fetch("/api/yield/chain")
    .then((r) => r.json())
    .then((data) => {
      const map = new Map<number, MarketYieldEntry>();
      for (const m of data?.perMarket ?? []) {
        map.set(m.id, m);
      }
      _cache = map;
      _lastFetch = Date.now();
      _inflight = null;
      return map;
    })
    .catch(() => {
      _inflight = null;
      return _cache ?? new Map();
    });

  return _inflight;
}

export function useMarketYield(marketId: number): {
  unrealizedYield: number;
  currentValueUsdc: number;
  investedPrincipal: number;
  loading: boolean;
} {
  const [entry, setEntry] = useState<MarketYieldEntry | null>(
    _cache?.get(marketId) ?? null
  );
  const [loading, setLoading] = useState(!_cache);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const map = await fetchYieldMap();
      if (!cancelled) {
        setEntry(map.get(marketId) ?? null);
        setLoading(false);
      }
    }

    load();

    intervalRef.current = setInterval(async () => {
      _lastFetch = 0; // force refresh on next call
      const map = await fetchYieldMap();
      if (!cancelled) setEntry(map.get(marketId) ?? null);
    }, POLL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [marketId]);

  return {
    unrealizedYield: entry?.unrealizedYield ?? 0,
    currentValueUsdc: entry?.currentValueUsdc ?? 0,
    investedPrincipal: entry?.investedPrincipal ?? 0,
    loading,
  };
}
