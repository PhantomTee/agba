import { type NextRequest } from "next/server";
import { getBridgeAdapter, getBridgeKit, parseBridgeChain } from "@/lib/bridge";
import { safeJson } from "@/lib/json";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fromChain = parseBridgeChain(String(body.fromChain || ""));
    const toChain = parseBridgeChain(String(body.toChain || ""));
    const amount = String(body.amount || "");
    if (!amount || Number(amount) <= 0) {
      return safeJson({ error: "fromChain, toChain, and positive amount are required" }, { status: 400 });
    }
    const kit = getBridgeKit();
    const adapter = getBridgeAdapter();
    const result = await kit.bridge({
      from: { adapter, chain: fromChain },
      to: { adapter, chain: toChain },
      amount,
      token: "USDC",
    });
    return safeJson({ result });
  } catch (error) {
    return safeJson(
      { error: error instanceof Error ? error.message : "Unable to execute Circle CCTP bridge transfer" },
      { status: 500 },
    );
  }
}
