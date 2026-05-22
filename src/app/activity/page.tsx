import type { Metadata } from "next";
import { PredictionActivityClient } from "@/components/PredictionActivityClient";

export const metadata: Metadata = {
  title: "Prediction Activity",
  description: "Recent real prediction activity across Agba markets.",
};

export default function ActivityPage() {
  return <PredictionActivityClient />;
}
