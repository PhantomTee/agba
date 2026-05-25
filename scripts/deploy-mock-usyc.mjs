/**
 * Deploys MockUSYCToken + MockUSYCTeller, transfers teller authority, then
 * redeploys AgbaMarket wired to the new mocks.
 *
 * Usage:
 *   node scripts/deploy-mock-usyc.mjs
 *
 * Required env vars (from .env.local):
 *   AGENT_PRIVATE_KEY, NEXT_PUBLIC_ARC_RPC, NEXT_PUBLIC_ARC_CHAIN_ID,
 *   NEXT_PUBLIC_USDC_ADDRESS
 *
 * Optional (falls back to existing defaults):
 *   NEXT_PUBLIC_EURC_ADDRESS
 *   USYC_YIELD_RESERVE_USDC  — how much USDC to seed the teller with (default 5)
 *
 * After running, update your .env.local and Vercel environment variables:
 *   NEXT_PUBLIC_CONTRACT_ADDRESS=<newAgbaMarket>
 *   NEXT_PUBLIC_USYC_ADDRESS=<mockUsycToken>
 *   NEXT_PUBLIC_USYC_TELLER=<mockUsycTeller>
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ContractFactory, JsonRpcProvider, Wallet, parseUnits } from "ethers";
import solc from "solc";

loadDotenvLocal();

function required(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
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

// ─── Compile all three contracts together ──────────────────────────────────

const contracts = {
  "MockUSYCToken.sol":  readFileSync(resolve("contracts", "MockUSYCToken.sol"), "utf8"),
  "MockUSYCTeller.sol": readFileSync(resolve("contracts", "MockUSYCTeller.sol"), "utf8"),
  "AgbaMarket.sol":     readFileSync(resolve("contracts", "AgbaMarket.sol"), "utf8"),
};

const input = {
  language: "Solidity",
  sources: Object.fromEntries(Object.entries(contracts).map(([name, content]) => [name, { content }])),
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors || []).filter((e) => e.severity === "error");
if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join("\n"));

function artifact(file, contract) {
  return output.contracts[file][contract];
}

// ─── Provider + wallet ──────────────────────────────────────────────────────

const provider = new JsonRpcProvider(
  required("NEXT_PUBLIC_ARC_RPC"),
  Number(required("NEXT_PUBLIC_ARC_CHAIN_ID"))
);
const wallet = new Wallet(required("AGENT_PRIVATE_KEY"), provider);

console.log(`\nDeployer: ${wallet.address}`);
console.log(`Network:  chain ${await provider.getNetwork().then((n) => n.chainId)}\n`);

// ─── 1. Deploy MockUSYCToken ────────────────────────────────────────────────

process.stdout.write("Deploying MockUSYCToken … ");
const tokenArtifact = artifact("MockUSYCToken.sol", "MockUSYCToken");
const tokenFactory = new ContractFactory(tokenArtifact.abi, tokenArtifact.evm.bytecode.object, wallet);
const mockToken = await tokenFactory.deploy();
await mockToken.waitForDeployment();
const mockTokenAddress = await mockToken.getAddress();
console.log(`done → ${mockTokenAddress}`);

// ─── 2. Deploy MockUSYCTeller ───────────────────────────────────────────────

const usdcAddress = required("NEXT_PUBLIC_USDC_ADDRESS");
process.stdout.write("Deploying MockUSYCTeller … ");
const tellerArtifact = artifact("MockUSYCTeller.sol", "MockUSYCTeller");
const tellerFactory = new ContractFactory(tellerArtifact.abi, tellerArtifact.evm.bytecode.object, wallet);
const mockTeller = await tellerFactory.deploy(usdcAddress, mockTokenAddress);
await mockTeller.waitForDeployment();
const mockTellerAddress = await mockTeller.getAddress();
console.log(`done → ${mockTellerAddress}`);

// ─── 3. Transfer mint/burn authority to the teller ─────────────────────────

process.stdout.write("Granting teller authority on MockUSYCToken … ");
const setTellerTx = await mockToken.setTeller(mockTellerAddress);
await setTellerTx.wait();
console.log("done");

// ─── 4. Seed teller with USDC for simulated yield ──────────────────────────

const reserveAmount = withDefault("USYC_YIELD_RESERVE_USDC", "5");
const reserveRaw = parseUnits(reserveAmount, 6);

const usdcAbi = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];
const usdcContract = new (await import("ethers")).Contract(usdcAddress, usdcAbi, wallet);
const deployerBalance = await usdcContract.balanceOf(wallet.address);

if (deployerBalance >= reserveRaw) {
  process.stdout.write(`Seeding teller with ${reserveAmount} USDC for yield reserve … `);
  const seedTx = await usdcContract.transfer(mockTellerAddress, reserveRaw);
  await seedTx.wait();
  console.log("done");
} else {
  console.log(
    `⚠  Skipped teller seed — deployer only has ${deployerBalance / BigInt(1e6)} USDC.` +
    ` Transfer some USDC to ${mockTellerAddress} to fund simulated yield.`
  );
}

// ─── 5. Redeploy AgbaMarket ─────────────────────────────────────────────────

const eurcAddress = withDefault("NEXT_PUBLIC_EURC_ADDRESS", "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a");
process.stdout.write("Deploying AgbaMarket … ");
const agbaArtifact = artifact("AgbaMarket.sol", "AgbaMarket");
const agbaFactory = new ContractFactory(agbaArtifact.abi, agbaArtifact.evm.bytecode.object, wallet);
const agbaMarket = await agbaFactory.deploy(usdcAddress, eurcAddress, mockTokenAddress, mockTellerAddress);
await agbaMarket.waitForDeployment();
const agbaAddress = await agbaMarket.getAddress();
console.log(`done → ${agbaAddress}`);

// ─── Summary ────────────────────────────────────────────────────────────────

const result = {
  newContractAddress: agbaAddress,
  mockUsycTokenAddress: mockTokenAddress,
  mockUsycTellerAddress: mockTellerAddress,
  deployer: wallet.address,
};

console.log("\n─── Update these in .env.local and Vercel env vars ──────────────────");
console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${agbaAddress}`);
console.log(`NEXT_PUBLIC_USYC_ADDRESS=${mockTokenAddress}`);
console.log(`NEXT_PUBLIC_USYC_TELLER=${mockTellerAddress}`);
console.log("────────────────────────────────────────────────────────────────────\n");
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
