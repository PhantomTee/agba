import { Chain, ClobClient } from "@polymarket/clob-client-v2";
import { getEnv } from "./env";

export function getPolymarketClient() {
  return new ClobClient({
    host: getEnv("POLYMARKET_CLOB_HOST"),
    chain: parsePolymarketChain(getEnv("POLYMARKET_CHAIN_ID")),
    builderConfig: { builderCode: getEnv("POLYMARKET_BUILDER_CODE") },
  });
}

function parsePolymarketChain(value: string) {
  const chainId = Number(value);
  if (chainId === Chain.POLYGON) return Chain.POLYGON;
  if (chainId === Chain.AMOY) return Chain.AMOY;
  throw new Error("POLYMARKET_CHAIN_ID must be 137 or 80002");
}
