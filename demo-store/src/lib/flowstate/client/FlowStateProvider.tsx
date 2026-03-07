"use client";

import { createContext, useContext, type ReactNode } from "react";
import { type FlowStateConfig } from "../types";
import { CONTRACT_ADDRESSES } from "@/lib/constants";

interface FlowStateContextValue {
  config: FlowStateConfig;
  contracts: {
    escrowStateMachine: `0x${string}`;
    disputeResolver: `0x${string}`;
    paymentSplitter: `0x${string}`;
    mockRLUSD: `0x${string}`;
  };
}

const FlowStateContext = createContext<FlowStateContextValue | null>(null);

interface FlowStateProviderProps {
  config: FlowStateConfig;
  children: ReactNode;
}

export function FlowStateProvider({ config, children }: FlowStateProviderProps) {
  const contracts = {
    escrowStateMachine:
      config.contracts?.escrowStateMachine ?? CONTRACT_ADDRESSES.escrowStateMachine,
    disputeResolver:
      config.contracts?.disputeResolver ?? CONTRACT_ADDRESSES.disputeResolver,
    paymentSplitter:
      config.contracts?.paymentSplitter ?? CONTRACT_ADDRESSES.paymentSplitter,
    mockRLUSD: config.contracts?.mockRLUSD ?? CONTRACT_ADDRESSES.mockRLUSD,
  };

  return (
    <FlowStateContext.Provider value={{ config, contracts }}>
      {children}
    </FlowStateContext.Provider>
  );
}

export function useFlowState() {
  const ctx = useContext(FlowStateContext);
  if (!ctx) throw new Error("useFlowState must be used inside FlowStateProvider");
  return ctx;
}
