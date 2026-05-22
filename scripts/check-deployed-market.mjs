import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Contract, JsonRpcProvider } from "ethers";

loadDotenvLocal();

const abi = [
  "function marketCount() view returns (uint256)",
  "function eurcToken() view returns (address)",
  "function usycToken() view returns (address)",
  "function usycTeller() view returns (address)",
];

const provider = new JsonRpcProvider(required("NEXT_PUBLIC_ARC_RPC"), Number(required("NEXT_PUBLIC_ARC_CHAIN_ID")));
const contract = new Contract(required("NEXT_PUBLIC_CONTRACT_ADDRESS"), abi, provider);
const [marketCount, eurcToken, usycToken, usycTeller] = await Promise.all([
  contract.marketCount(),
  contract.eurcToken(),
  contract.usycToken(),
  contract.usycTeller(),
]);

process.stdout.write(`${JSON.stringify({
  marketCount: marketCount.toString(),
  eurcToken,
  usycToken,
  usycTeller,
}, null, 2)}\n`);

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
