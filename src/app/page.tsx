import { HomeClient } from "@/components/HomeClient";

export default function Home({ searchParams }: { searchParams: { category?: string } }) {
  return <HomeClient category={searchParams.category} />;
}
