"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { publicConfig } from "@/lib/env";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const publicEnv = publicConfig();
  const walletConfigured = Boolean(publicEnv.arcRpc && publicEnv.arcChainId && process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID);
  const [wagmiConfig] = useState(() => {
    const config = publicConfig();
    if (!config.arcRpc || !config.arcChainId || !process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) return undefined;
    const chain = {
      id: config.arcChainId,
      name: "Arc Testnet",
      nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
      rpcUrls: { default: { http: [config.arcRpc] } },
      blockExplorers: undefined,
    } as const;
    return createConfig(
      getDefaultConfig({
        appName: "Agba",
        chains: [chain],
        transports: { [chain.id]: http(config.arcRpc) },
        walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
      }),
    );
  });

  if (!walletConfigured || !wagmiConfig) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider mode="dark" customTheme={{ "--ck-accent-color": "#f5a623", "--ck-body-background": "#101010" }}>
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
