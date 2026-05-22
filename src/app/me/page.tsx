import type { Metadata } from "next";
import { MeBalanceClient } from "@/components/MeBalanceClient";

export const metadata: Metadata = {
  title: "Me",
  description: "See your USDC balances across supported testnet networks.",
};

export default function MePage() {
  return <MeBalanceClient />;
}
