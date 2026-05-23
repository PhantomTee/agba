import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { MARKET_ABI } from "../src/lib/constants.ts";

loadDotenvLocal();

const provider = new JsonRpcProvider(required("NEXT_PUBLIC_ARC_RPC"), Number(required("NEXT_PUBLIC_ARC_CHAIN_ID")));
const wallet = new Wallet(required("AGENT_PRIVATE_KEY"), provider);
const contract = new Contract(required("NEXT_PUBLIC_CONTRACT_ADDRESS"), MARKET_ABI, wallet);

const gas = await contract["createMarket(string,string,string,string,string,uint256,uint256)"].estimateGas(
  "Will INEC appeal the Federal High Court ruling within 14 days?",
  "POLITICS",
  "NG",
  "Federal High Court Ruling",
  "https://example.com/story",
  14,
  55,
);

process.stdout.write(`${JSON.stringify({ createMarketEstimateGas: gas.toString(), contractAddress: await contract.getAddress() }, null, 2)}\n`);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function loadDotenvLocal() {
  const path = resolve(".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}
