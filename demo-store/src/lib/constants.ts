import { defineChain } from "viem";

// XRPL EVM Sidechain Testnet
export const xrplEvmTestnet = defineChain({
  id: 1449000,
  name: "XRPL EVM Sidechain Testnet",
  nativeCurrency: { name: "XRP", symbol: "XRP", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.xrplevm.org"] },
    public: { http: ["https://rpc.testnet.xrplevm.org"] },
  },
  blockExplorers: {
    default: {
      name: "XRPL EVM Explorer",
      url: "https://explorer.testnet.xrplevm.org",
    },
  },
  testnet: true,
});

// Contract addresses — always from env vars, never hardcoded
export const CONTRACT_ADDRESSES = {
  mockRLUSD: process.env.NEXT_PUBLIC_MOCK_RLUSD_ADDRESS as `0x${string}`,
  escrowStateMachine: process.env
    .NEXT_PUBLIC_ESCROW_STATE_MACHINE_ADDRESS as `0x${string}`,
  disputeResolver: process.env
    .NEXT_PUBLIC_DISPUTE_RESOLVER_ADDRESS as `0x${string}`,
  paymentSplitter: process.env
    .NEXT_PUBLIC_PAYMENT_SPLITTER_ADDRESS as `0x${string}`,
} as const;

// Payout schedule basis points (total = 10000 = 100%)
export const PAYOUT_SCHEDULE = {
  LABEL_CREATED: 1500, // 15%
  SHIPPED: 1500, // 15%
  IN_TRANSIT: 2000, // 20%
  DELIVERED: 3500, // 35%
  FINALIZED: 1500, // 15% (minus 2.5% platform fee)
} as const;

export const PLATFORM_FEE_BPS = 250; // 2.5%

// Grace period before FINALIZED state (seconds)
export const GRACE_PERIOD_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const XRPL_FAUCET_URL = "https://faucet.xrplevm.org";
export const XRPL_EXPLORER_URL = "https://explorer.testnet.xrplevm.org";
