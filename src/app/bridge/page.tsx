import type { Metadata } from "next";
import { BridgeClient } from "@/components/BridgeClient";

export const metadata: Metadata = {
  title: "Bridge",
  description: "Bridge USDC to Arc testnet via Circle CCTP so you can bet on Àgbà markets.",
};

export default function BridgePage() {
  return <BridgeClient />;
}
