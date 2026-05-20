import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { getPolymarketClient } from "@/lib/polymarket";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const client = getPolymarketClient();
    await client.getOk();
    const cursor = request.nextUrl.searchParams.get("cursor") || undefined;
    const response = await client.getBuilderTrades({ builder_code: getEnv("POLYMARKET_BUILDER_CODE") }, cursor);
    return NextResponse.json({
      builderCode: getEnv("POLYMARKET_BUILDER_CODE"),
      trades: response.trades,
      nextCursor: response.next_cursor,
      count: response.count,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch Polymarket builder trades" },
      { status: 500 },
    );
  }
}
