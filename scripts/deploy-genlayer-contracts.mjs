import { readFile } from "node:fs/promises";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { loadLocalEnv, updateLocalEnv } from "./genlayer-env.mjs";

const required = ["GENLAYER_RPC_URL", "GENLAYER_PRIVATE_KEY"];
const env = loadLocalEnv();
for (const name of required) {
  if (!env[name]) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
}

const account = createAccount(env.GENLAYER_PRIVATE_KEY);
const client = createClient({
  chain: studionet,
  endpoint: env.GENLAYER_RPC_URL,
  account,
});

async function deploy(label, path) {
  const code = await readFile(path, "utf8");
  const txHash = await client.deployContract({ code, args: [] });
  console.log(`${label}_DEPLOY_TX=${txHash}`);
  return txHash;
}

async function waitForContractAddress(txHash) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const tx = await client.getTransaction({ hash: txHash }).catch(() => null);
    const address = findContractAddress(tx);
    if (address) return address;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  return "";
}

function findContractAddress(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return "";
  seen.add(value);
  if (typeof value.contract_address === "string" && value.contract_address.startsWith("0x")) {
    return value.contract_address;
  }
  if (typeof value.contractAddress === "string" && value.contractAddress.startsWith("0x")) {
    return value.contractAddress;
  }
  for (const child of Object.values(value)) {
    const found = findContractAddress(child, seen);
    if (found) return found;
  }
  return "";
}

console.log(`GENLAYER_DEPLOYER=${account.address}`);
const creatorTx = await deploy("GENLAYER_MARKET_CREATOR", "contracts/genlayer/MarketCreator.py");
const resolverTx = await deploy("GENLAYER_MARKET_RESOLVER", "contracts/genlayer/MarketResolver.py");
const creatorAddress = await waitForContractAddress(creatorTx);
const resolverAddress = await waitForContractAddress(resolverTx);
const updates = {
  GENLAYER_MARKET_CREATOR_DEPLOY_TX: creatorTx,
  GENLAYER_MARKET_RESOLVER_DEPLOY_TX: resolverTx,
};
if (creatorAddress) updates.GENLAYER_MARKET_CREATOR_ADDRESS = creatorAddress;
if (resolverAddress) updates.GENLAYER_MARKET_RESOLVER_ADDRESS = resolverAddress;
updateLocalEnv(updates);
console.log("Deployment transactions saved to .env.local.");
if (creatorAddress) console.log(`GENLAYER_MARKET_CREATOR_ADDRESS=${creatorAddress}`);
if (resolverAddress) console.log(`GENLAYER_MARKET_RESOLVER_ADDRESS=${resolverAddress}`);
if (!creatorAddress || !resolverAddress) {
  console.log("Set any missing GenLayer contract address after the deployment finalizes.");
}
