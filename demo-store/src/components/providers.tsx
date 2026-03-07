"use client";

import { type ReactNode, useEffect } from "react";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { FlowStateProvider } from "@/lib/flowstate/client/FlowStateProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useUserStore } from "@/stores/user-store";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

const flowStateConfig = {
  projectId: "demo",
  apiKey: "demo-key",
  network: "testnet" as const,
};

// Syncs Supabase auth session into user store and wallet address on connect
function AuthSync() {
  const { syncFromSession, setWallet } = useUserStore();
  const { address } = useAccount();

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      // No Supabase configured — mark loading as done
      useUserStore.getState().clearUser();
      return;
    }

    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      syncFromSession(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncFromSession(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [syncFromSession]);

  useEffect(() => {
    if (address) setWallet(address);
  }, [address, setWallet]);

  return null;
}

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
            <AuthSync />
            {children}
          </FlowStateProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
