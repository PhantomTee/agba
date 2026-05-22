export function calculateOdds(yesPool: number, noPool: number, initialYesProbability?: number | null) {
  const total = yesPool + noPool;
  if (total <= 0) {
    const initialOdds = normalizeInitialOdds(initialYesProbability);
    const source = initialYesProbability == null ? "neutral" : "ai";
    return { yesOdds: initialOdds, noOdds: 100 - initialOdds, source };
  }
  const yesOdds = Math.round((yesPool / total) * 100);
  return { yesOdds, noOdds: 100 - yesOdds, source: "pool" as const };
}

export function formatUsdc(value: number | string) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number.isFinite(numeric) ? numeric : 0);
}

export function timeRemaining(iso: string | null) {
  if (!iso) return "No resolution date";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Resolution due";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
}

function normalizeInitialOdds(initialYesProbability?: number | null) {
  if (initialYesProbability == null || !Number.isFinite(initialYesProbability)) return 50;
  return Math.min(99, Math.max(1, Math.round(initialYesProbability)));
}
