import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";
import solc from "solc";

loadDotenvLocal();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function withDefault(name, fallback) {
  return process.env[name] || fallback;
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

const sourcePath = resolve("contracts", "AgbaMarket.sol");
const source = readFileSync(sourcePath, "utf8");
const input = {
  language: "Solidity",
  sources: {
    "AgbaMarket.sol": { content: source },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors?.filter((error) => error.severity === "error") || [];
if (errors.length > 0) {
  throw new Error(errors.map((error) => error.formattedMessage).join("\n"));
}

const artifact = output.contracts["AgbaMarket.sol"].AgbaMarket;
const provider = new JsonRpcProvider(required("NEXT_PUBLIC_ARC_RPC"), Number(required("NEXT_PUBLIC_ARC_CHAIN_ID")));
const wallet = new Wallet(required("AGENT_PRIVATE_KEY"), provider);
const factory = new ContractFactory(artifact.abi, artifact.evm.bytecode.object, wallet);
const contract = await factory.deploy(
  required("NEXT_PUBLIC_USDC_ADDRESS"),
  withDefault("NEXT_PUBLIC_EURC_ADDRESS", "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"),
  withDefault("NEXT_PUBLIC_USYC_ADDRESS", "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C"),
  withDefault("NEXT_PUBLIC_USYC_TELLER", "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A"),
);
await contract.waitForDeployment();

process.stdout.write(`${JSON.stringify({ contractAddress: await contract.getAddress(), deployer: wallet.address }, null, 2)}\n`);
