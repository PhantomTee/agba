import { BridgeChain, BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { getEnv } from "./env";

export function parseBridgeChain(value: string) {
  const chain = Object.values(BridgeChain).find((candidate) => candidate === value);
  if (!chain) {
    throw new Error(`Unsupported bridge chain: ${value}`);
  }
  return chain;
}

export function getBridgeKit() {
  return new BridgeKit({ disableErrorReporting: true });
}

export function getBridgeAdapter() {
  return createViemAdapterFromPrivateKey({
    privateKey: getEnv("BRIDGE_ESTIMATE_PRIVATE_KEY") as `0x${string}`,
  });
}
