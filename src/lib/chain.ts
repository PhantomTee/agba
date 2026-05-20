import { Contract, JsonRpcProvider, Wallet, parseUnits } from "ethers";
import { ERC20_ABI, MARKET_ABI } from "./constants";
import { getEnv } from "./env";

let provider: JsonRpcProvider | null = null;
let agentWallet: Wallet | null = null;

export function getArcProvider() {
  if (!provider) {
    provider = new JsonRpcProvider(getEnv("NEXT_PUBLIC_ARC_RPC"), Number(getEnv("NEXT_PUBLIC_ARC_CHAIN_ID")));
  }
  return provider;
}

export function getAgentWallet() {
  if (!agentWallet) {
    agentWallet = new Wallet(getEnv("AGENT_PRIVATE_KEY"), getArcProvider());
  }
  return agentWallet;
}

export function getMarketContract(signer = getAgentWallet()) {
  return new Contract(getEnv("NEXT_PUBLIC_CONTRACT_ADDRESS"), MARKET_ABI, signer);
}

export function getReadOnlyMarketContract() {
  return new Contract(getEnv("NEXT_PUBLIC_CONTRACT_ADDRESS"), MARKET_ABI, getArcProvider());
}

export function getReadOnlyUsdcContract() {
  return new Contract(getEnv("NEXT_PUBLIC_USDC_ADDRESS"), ERC20_ABI, getArcProvider());
}

export function toUsdcUnits(amount: string | number) {
  return parseUnits(String(amount), 6);
}
