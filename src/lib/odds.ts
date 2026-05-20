export function calculateOdds(yesPool: number, noPool: number) {
  const total = yesPool + noPool;
  if (total <= 0) {
    return { yesOdds: 50, noOdds: 50 };
  }
  const yesOdds = Math.round((yesPool / total) * 100);
  return { yesOdds, noOdds: 100 - yesOdds };
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
