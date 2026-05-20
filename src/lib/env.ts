export function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export function publicConfig() {
  return {
    contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "",
    usdcAddress: process.env.NEXT_PUBLIC_USDC_ADDRESS || "",
    arcRpc: process.env.NEXT_PUBLIC_ARC_RPC || "",
    arcChainId: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || "0"),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  };
}
