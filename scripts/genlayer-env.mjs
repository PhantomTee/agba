import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { resolve } from "node:path";

export const STUDIONET = {
  chainId: "61999",
  rpcUrl: "https://studio.genlayer.com/api",
  explorerUrl: "https://explorer-studio.genlayer.com",
  tokenSymbol: "GEN",
};

export const envPath = resolve(".env.local");

export function loadLocalEnv() {
  const env = { ...process.env };
  if (!existsSync(envPath)) return env;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    env[key] = unquoteEnvValue(value);
  }
  return env;
}

export function updateLocalEnv(updates) {
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  const seen = new Set();
  const next = existing.map((line) => {
    const index = line.indexOf("=");
    if (index === -1 || line.trim().startsWith("#")) return line;
    const key = line.slice(0, index);
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${updates[key]}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) next.push(`${key}=${value}`);
  }

  writeFileSync(envPath, `${next.filter((line, index) => line || index < next.length - 1).join("\n")}\n`, { mode: 0o600 });
  try {
    chmodSync(envPath, 0o600);
  } catch {
    // Best effort on platforms that support POSIX permissions.
  }
}

export function requireStudionetEnv() {
  const env = loadLocalEnv();
  const chainId = env.GENLAYER_CHAIN_ID || STUDIONET.chainId;
  const rpcUrl = env.GENLAYER_RPC_URL || STUDIONET.rpcUrl;
  if (chainId !== STUDIONET.chainId) {
    throw new Error(`Refusing to use non-Studionet chain id ${chainId}. Expected ${STUDIONET.chainId}.`);
  }
  if (rpcUrl !== STUDIONET.rpcUrl) {
    throw new Error(`Refusing to fund/check a non-Studionet RPC: ${rpcUrl}`);
  }
  if (!env.GENLAYER_AGENT_ADDRESS) throw new Error("Missing GENLAYER_AGENT_ADDRESS. Run npm run genlayer:wallet:create first.");
  return { ...env, GENLAYER_CHAIN_ID: chainId, GENLAYER_RPC_URL: rpcUrl };
}

function unquoteEnvValue(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
