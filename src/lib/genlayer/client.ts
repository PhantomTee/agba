import { JsonRpcProvider, Wallet } from "ethers";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { CalldataEncodable, TransactionHash } from "genlayer-js/types";
import type { NextRequest } from "next/server";
import { getEnv, getOptionalEnv } from "@/lib/env";

export type GenLayerUnavailable = { status: "NOT_CONFIGURED"; reason: string };
export type GenLayerError = { status: "ERROR"; error: string };
export type GenLayerPending = { status: "REQUESTED"; txHash: string };
export type GenLayerReady<T> = { status: "READY"; txHash?: string; output: T };
export type GenLayerResult<T> = GenLayerUnavailable | GenLayerError | GenLayerPending | GenLayerReady<T>;

type GenLayerContractRole = "MARKET_CREATOR" | "MARKET_RESOLVER";

const STUDIONET_CHAIN_ID = 61999;
const STUDIONET_RPC_URL = "https://studio.genlayer.com/api";
const STUDIONET_EXPLORER_URL = "https://explorer-studio.genlayer.com";
const STUDIONET_TOKEN_SYMBOL = "GEN";

let provider: JsonRpcProvider | null = null;
let wallet: Wallet | null = null;

type NormalizedRpcResult = {
  status?: string;
  txHash?: string;
  output?: unknown;
  proposal?: unknown;
  decision?: unknown;
  error?: string;
};

export function assertXCronSecret(request: NextRequest) {
  const expected = getEnv("CRON_SECRET");
  const provided = request.headers.get("x-cron-secret");
  if (provided !== expected) throw new Error("Unauthorized cron request");
}

export function isGroqFallbackEnabled() {
  return getOptionalEnv("USE_GROQ_FALLBACK") === "true";
}

export function getGenLayerConfig(role: GenLayerContractRole): GenLayerUnavailable | {
  rpcUrl: string;
  chainId: number;
  privateKey: string;
  contractAddress: string;
} {
  const rpcUrl = getOptionalEnv("GENLAYER_RPC_URL");
  const chainId = Number(getOptionalEnv("GENLAYER_CHAIN_ID"));
  const privateKey = getOptionalEnv("GENLAYER_PRIVATE_KEY");
  const contractAddress = getOptionalEnv(
    role === "MARKET_CREATOR" ? "GENLAYER_MARKET_CREATOR_ADDRESS" : "GENLAYER_MARKET_RESOLVER_ADDRESS",
  );

  if (!rpcUrl || !Number.isFinite(chainId) || !privateKey || !contractAddress) {
    return {
      status: "NOT_CONFIGURED",
      reason: "Missing GENLAYER_RPC_URL, GENLAYER_CHAIN_ID, GENLAYER_PRIVATE_KEY, or GenLayer contract address",
    };
  }

  if (chainId !== STUDIONET_CHAIN_ID || rpcUrl !== STUDIONET_RPC_URL) {
    return { status: "NOT_CONFIGURED", reason: "GenLayer client is configured for non-Studionet network values" };
  }

  return { rpcUrl, chainId, privateKey, contractAddress };
}

export function getGenLayerProvider(): GenLayerUnavailable | JsonRpcProvider {
  const rpcUrl = getOptionalEnv("GENLAYER_RPC_URL");
  const chainId = Number(getOptionalEnv("GENLAYER_CHAIN_ID"));
  if (!rpcUrl || !Number.isFinite(chainId)) {
    return { status: "NOT_CONFIGURED", reason: "Missing GENLAYER_RPC_URL or GENLAYER_CHAIN_ID" };
  }
  if (chainId !== STUDIONET_CHAIN_ID || rpcUrl !== STUDIONET_RPC_URL) {
    return { status: "NOT_CONFIGURED", reason: "GenLayer provider is configured for non-Studionet network values" };
  }
  if (!provider) provider = new JsonRpcProvider(rpcUrl, chainId);
  return provider;
}

export function getGenLayerWallet(): GenLayerUnavailable | Wallet {
  const privateKey = getOptionalEnv("GENLAYER_PRIVATE_KEY");
  if (!privateKey) return { status: "NOT_CONFIGURED", reason: "Missing GENLAYER_PRIVATE_KEY" };
  const configuredProvider = getGenLayerProvider();
  if ("status" in configuredProvider) return configuredProvider;
  if (!wallet) wallet = new Wallet(privateKey, configuredProvider);
  return wallet;
}

export async function fundGenLayerAccount(address: string, amountWei: string): Promise<GenLayerUnavailable | { status: "FUNDED"; response: unknown }> {
  const configuredProvider = getGenLayerProvider();
  if ("status" in configuredProvider) return configuredProvider;
  const response = await configuredProvider.send("sim_fundAccount", [address, amountWei]);
  return { status: "FUNDED", response };
}

export async function getGenLayerBalance(address: string): Promise<GenLayerUnavailable | { status: "READY"; balanceWei: bigint }> {
  const configuredProvider = getGenLayerProvider();
  if ("status" in configuredProvider) return configuredProvider;
  const balanceWei = await configuredProvider.getBalance(address);
  return { status: "READY", balanceWei };
}

export async function callGenLayer<T>(
  role: GenLayerContractRole,
  method: string,
  input: unknown,
  validate: (value: unknown) => T,
): Promise<GenLayerResult<T>> {
  const config = getGenLayerConfig(role);
  if ("status" in config) return config;

  try {
    const client = createGenLayerSdkClient(config);
    if (method === "genlayer_checkMarketCreation" || method === "genlayer_checkMarketResolution") {
      const txHash = getTxHashInput(input);
      if (!txHash) return { status: "ERROR", error: "txHash is required" };
      const tx = await client.getTransaction({ hash: txHash });
      const output = extractJsonOutput(tx);
      if (!output) return { status: "REQUESTED", txHash };
      return normalizeGenLayerResult({ status: "READY", txHash, output }, validate);
    }

    const call = buildContractCall(role, method, input);
    if (!call) return { status: "ERROR", error: `Unsupported GenLayer method: ${method}` };
    const result = await client.simulateWriteContract({
      address: config.contractAddress as `0x${string}`,
      functionName: call.functionName,
      args: call.args,
    });
    return normalizeGenLayerResult(result, validate);
  } catch (error) {
    return { status: "ERROR", error: error instanceof Error ? error.message : "GenLayer request failed" };
  }
}

function createGenLayerSdkClient(config: { rpcUrl: string; privateKey: string }) {
  const account = createAccount(config.privateKey as `0x${string}`);
  return createClient({ chain: studionet, endpoint: config.rpcUrl, account });
}

function buildContractCall(role: GenLayerContractRole, method: string, input: unknown): { functionName: string; args: CalldataEncodable[] } | null {
  if (!input || typeof input !== "object") return null;
  const data = input as Record<string, unknown>;
  if (role === "MARKET_CREATOR" && method === "genlayer_requestMarketCreation") {
    return {
      functionName: "propose",
      args: [
        String(data.title || ""),
        String(data.summary || ""),
        String(data.sourceUrl || ""),
        String(data.categoryHint || ""),
        String(data.publishedAt || ""),
      ],
    };
  }
  if (role === "MARKET_RESOLVER" && method === "genlayer_requestMarketResolution") {
    return {
      functionName: "resolve",
      args: [
        String(data.question || ""),
        String(data.resolutionCriteria || ""),
        String(data.resolutionSourceUrl || ""),
        String(data.resolvesAt || ""),
      ],
    };
  }
  return null;
}

function getTxHashInput(input: unknown): TransactionHash | null {
  if (!input || typeof input !== "object") return null;
  const txHash = (input as Record<string, unknown>).txHash;
  return typeof txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(txHash) ? (txHash as TransactionHash) : null;
}

function extractJsonOutput(value: unknown): unknown {
  const seen = new Set<unknown>();
  const visit = (item: unknown): unknown => {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          return JSON.parse(trimmed);
        } catch {
          return undefined;
        }
      }
      return undefined;
    }
    if (!item || typeof item !== "object" || seen.has(item)) return undefined;
    seen.add(item);
    if (Array.isArray(item)) {
      for (const child of item) {
        const found = visit(child);
        if (found) return found;
      }
      return undefined;
    }
    for (const child of Object.values(item as Record<string, unknown>)) {
      const found = visit(child);
      if (found) return found;
    }
    return undefined;
  };
  return visit(value);
}

function normalizeGenLayerResult<T>(raw: unknown, validate: (value: unknown) => T): GenLayerResult<T> {
  const result = normalizeObject(raw);
  const status = String(result.status || "").toUpperCase();
  const txHash = typeof result.txHash === "string" && result.txHash ? result.txHash : undefined;

  if (status === "NOT_CONFIGURED") return { status: "NOT_CONFIGURED", reason: "GenLayer RPC reported not configured" };
  if (status === "REQUESTED" || status === "PENDING") {
    if (!txHash) return { status: "ERROR", error: "GenLayer returned pending status without a tx hash" };
    return { status: "REQUESTED", txHash };
  }
  if (status === "ERROR") return { status: "ERROR", error: result.error || "GenLayer returned an error" };

  const output = result.output ?? result.proposal ?? result.decision ?? result;
  try {
    return { status: "READY", txHash, output: validate(output) };
  } catch (error) {
    return { status: "ERROR", error: error instanceof Error ? error.message : "GenLayer output validation failed" };
  }
}

function normalizeObject(raw: unknown): NormalizedRpcResult {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as NormalizedRpcResult;
    } catch {
      return { output: raw };
    }
  }
  if (raw && typeof raw === "object") return raw as NormalizedRpcResult;
  return { output: raw };
}
