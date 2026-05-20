import { MarketDetailClient } from "@/components/MarketDetailClient";

export default function MarketPage({ params }: { params: { id: string } }) {
  return <MarketDetailClient id={params.id} />;
}
