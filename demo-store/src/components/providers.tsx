"use client";

import { type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { FlowStateProvider } from "@/lib/flowstate/client/FlowStateProvider";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

const flowStateConfig = {
  projectId: "demo",
  apiKey: "demo-key",
  network: "testnet" as const,
};

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#7c3aed",
            accentColorForeground: "white",
            borderRadius: "medium",
          })}
        >
          <FlowStateProvider config={flowStateConfig}>
            {children}
          </FlowStateProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
