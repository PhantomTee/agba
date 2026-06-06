import { NextResponse, type NextRequest } from "next/server";
import { assertCronRequest } from "@/lib/auth";
import { runAgentResolve } from "@/lib/agentResolve";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    assertCronRequest(request);
    return NextResponse.json(await runAgentResolve());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to resolve markets" }, { status: 500 });
  }
}
