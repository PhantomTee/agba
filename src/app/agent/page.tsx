import type { Metadata } from "next";
import { AgentStatusClient } from "@/components/AgentStatusClient";

export const metadata: Metadata = {
  title: "Agent",
  description: "Live feed of the Àgbà AI agent — every article scanned, every market created, and every pending resolution.",
};

export default function AgentPage() {
  return <AgentStatusClient />;
}
