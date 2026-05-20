import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";
import solc from "solc";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
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
const contract = await factory.deploy(required("NEXT_PUBLIC_USDC_ADDRESS"));
await contract.waitForDeployment();

process.stdout.write(`${JSON.stringify({ contractAddress: await contract.getAddress(), deployer: wallet.address }, null, 2)}\n`);
