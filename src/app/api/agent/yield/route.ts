import { type NextRequest } from "next/server";
import { assertCronRequest } from "@/lib/auth";
import { runAgentUSYCSweep } from "@/lib/agentYield";
import { safeJson } from "@/lib/json";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    assertCronRequest(request);
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unauthorized cron request" }, { status: 401 });
  }

  try {
    const result = await runAgentUSYCSweep();
    return safeJson(result);
  } catch (error) {
    return safeJson({ error: error instanceof Error ? error.message : "Unable to run agent USYC sweep" }, { status: 500 });
  }
}
