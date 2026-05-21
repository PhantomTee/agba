import type { Metadata } from "next";
import { LeaderboardClient } from "@/components/LeaderboardClient";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Top predictors on Àgbà ranked by USDC won, accuracy, and total volume.",
};

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
