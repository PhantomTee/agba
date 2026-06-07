import { type NextRequest } from "next/server";
import { runAgentScan } from "@/lib/agentScan";
import { assertXCronSecret, isUnauthorizedCronError } from "@/lib/genlayer/client";
import { safeJson } from "@/lib/json";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    assertXCronSecret(request);
    return safeJson(await runAgentScan());
  } catch (error) {
    if (isUnauthorizedCronError(error)) return safeJson({ error: "Unauthorized cron request" }, { status: 401 });
    return safeJson({ error: error instanceof Error ? error.message : "Unable to request GenLayer market" }, { status: 500 });
  }
}
