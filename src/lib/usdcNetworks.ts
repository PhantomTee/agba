export type UsdcNetwork = {
  id: string;
  label: string;
  bridgeId: string;
  chainId: number;
  rpcUrl: string;
  usdcAddress: string;
};

const env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {};

export const USDC_NETWORKS: UsdcNetwork[] = [
  {
    id: "ethereum-sepolia",
    label: "Ethereum Sepolia",
    bridgeId: "Ethereum_Sepolia",
    chainId: 11155111,
    rpcUrl: env.ETHEREUM_SEPOLIA_RPC || env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com",
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
  {
    id: "base-sepolia",
    label: "Base Sepolia",
    bridgeId: "Base_Sepolia",
    chainId: 84532,
    rpcUrl: env.BASE_SEPOLIA_RPC || env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org",
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  {
    id: "arbitrum-sepolia",
    label: "Arbitrum Sepolia",
    bridgeId: "Arbitrum_Sepolia",
    chainId: 421614,
    rpcUrl: env.ARBITRUM_SEPOLIA_RPC || env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  },
  {
    id: "optimism-sepolia",
    label: "Optimism Sepolia",
    bridgeId: "Optimism_Sepolia",
    chainId: 11155420,
    rpcUrl: env.OPTIMISM_SEPOLIA_RPC || env.NEXT_PUBLIC_OPTIMISM_SEPOLIA_RPC || "https://sepolia.optimism.io",
    usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
  },
  {
    id: "arc-testnet",
    label: "Arc Testnet",
    bridgeId: "Arc_Testnet",
    chainId: Number(env.NEXT_PUBLIC_ARC_CHAIN_ID || "5042002"),
    rpcUrl: env.NEXT_PUBLIC_ARC_RPC || "https://rpc.testnet.arc.network",
    usdcAddress: env.NEXT_PUBLIC_USDC_ADDRESS || "0x3600000000000000000000000000000000000000",
  },
];

export function chainLabel(raw: string) {
  return USDC_NETWORKS.find((network) => network.bridgeId === raw || network.id === raw)?.label || raw.replace(/_/g, " ");
}

export function getUsdcNetworkByBridgeId(bridgeId: string) {
  return USDC_NETWORKS.find((network) => network.bridgeId === bridgeId);
}
