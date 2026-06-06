"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http, injected } from "wagmi";
import { publicConfig } from "@/lib/env";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  const [wagmiConfig] = useState(() => {
    const config = publicConfig();
    const chainId = config.arcChainId || 1337;
    const rpcUrl = config.arcRpc || "http://127.0.0.1:8545";
    const chain = {
      id: chainId,
      name: config.arcChainId ? "Arc Testnet" : "Local Wallet Fallback",
      nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
      blockExplorers: undefined,
    } as const;
    return createConfig({
      chains: [chain],
      connectors: [injected()],
      transports: { [chain.id]: http(rpcUrl) },
    });
  });

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
