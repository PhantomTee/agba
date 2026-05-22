"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http, injected } from "wagmi";
import { publicConfig } from "@/lib/env";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  const [wagmiConfig] = useState(() => {
    const config = publicConfig();
    if (!config.arcRpc || !config.arcChainId) return undefined;
    const chain = {
      id: config.arcChainId,
      name: "Arc Testnet",
      nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
      rpcUrls: { default: { http: [config.arcRpc] } },
      blockExplorers: undefined,
    } as const;
    return createConfig({
      chains: [chain],
      connectors: [injected()],
      transports: { [chain.id]: http(config.arcRpc) },
    });
  });

  if (!wagmiConfig) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
