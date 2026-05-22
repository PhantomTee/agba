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
    eurcAddress: process.env.NEXT_PUBLIC_EURC_ADDRESS || "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    usycAddress: process.env.NEXT_PUBLIC_USYC_ADDRESS || "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C",
    usycTeller: process.env.NEXT_PUBLIC_USYC_TELLER || "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A",
    arcRpc: process.env.NEXT_PUBLIC_ARC_RPC || "",
    arcChainId: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || "0"),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  };
}
