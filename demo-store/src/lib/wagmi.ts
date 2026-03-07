"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { xrplEvmTestnet } from "./constants";

export const wagmiConfig = getDefaultConfig({
  appName: "FlowState Demo Store",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo",
  chains: [xrplEvmTestnet],
  ssr: true,
});
