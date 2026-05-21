import type { Metadata } from "next";
import { MarketsClient } from "@/components/MarketsClient";

export const metadata: Metadata = {
  title: "Markets",
  description: "Browse all open prediction markets on Àgbà. Filter by forex, politics, sports, economy, and security.",
};

export default function MarketsPage() {
  return <MarketsClient />;
}
