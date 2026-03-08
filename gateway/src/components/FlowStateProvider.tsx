"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { type FlowStateConfig } from "../types/index";
import { FlowStateApiClient } from "../client/apiClient";
import { FlowStateWsClient } from "../client/wsClient";

const DEFAULT_CONTRACT_ADDRESSES = {
  escrowStateMachine: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  disputeResolver: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  paymentSplitter: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  mockRLUSD: "0x0000000000000000000000000000000000000000" as `0x${string}`,
};

interface FlowStateContextValue {
  config: FlowStateConfig;
  contracts: {
    escrowStateMachine: `0x${string}`;
    disputeResolver: `0x${string}`;
    paymentSplitter: `0x${string}`;
    mockRLUSD: `0x${string}`;
  };
  apiClient: FlowStateApiClient | null;
  wsClient: FlowStateWsClient | null;
}

const FlowStateContext = createContext<FlowStateContextValue | null>(null);

export interface FlowStateProviderProps {
  config: FlowStateConfig;
  contractAddresses?: {
    escrowStateMachine?: `0x${string}`;
    disputeResolver?: `0x${string}`;
    paymentSplitter?: `0x${string}`;
    mockRLUSD?: `0x${string}`;
  };
  children: ReactNode;
}

export function FlowStateProvider({
  config,
  contractAddresses,
  children,
}: FlowStateProviderProps) {
  const contracts = {
    escrowStateMachine:
      config.contracts?.escrowStateMachine ??
      contractAddresses?.escrowStateMachine ??
      DEFAULT_CONTRACT_ADDRESSES.escrowStateMachine,
    disputeResolver:
      config.contracts?.disputeResolver ??
      contractAddresses?.disputeResolver ??
      DEFAULT_CONTRACT_ADDRESSES.disputeResolver,
    paymentSplitter:
      config.contracts?.paymentSplitter ??
      contractAddresses?.paymentSplitter ??
      DEFAULT_CONTRACT_ADDRESSES.paymentSplitter,
    mockRLUSD:
      config.contracts?.mockRLUSD ??
      contractAddresses?.mockRLUSD ??
      DEFAULT_CONTRACT_ADDRESSES.mockRLUSD,
  };

  const apiClient = useMemo(() => {
    if (!config.baseUrl) return null;
    return new FlowStateApiClient({ baseUrl: config.baseUrl, apiKey: config.apiKey });
  }, [config.baseUrl, config.apiKey]);

  const wsClient = useMemo(() => {
    if (!config.baseUrl) return null;
    return new FlowStateWsClient({ baseUrl: config.baseUrl, apiKey: config.apiKey });
  }, [config.baseUrl, config.apiKey]);

  return (
    <FlowStateContext.Provider value={{ config, contracts, apiClient, wsClient }}>
      {children}
    </FlowStateContext.Provider>
  );
}

export function useFlowState() {
  const ctx = useContext(FlowStateContext);
  if (!ctx) throw new Error("useFlowState must be used inside FlowStateProvider");
  return ctx;
}
