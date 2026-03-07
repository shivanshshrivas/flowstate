/**
 * IBlockchainBridge — interface for XRPL EVM smart contract interactions.
 * Stub implementation returns mock transaction hashes and realistic shapes.
 * Replace with ethers.js / viem calls when smart contracts are deployed.
 */

import { nanoid } from "nanoid";

export interface VerifyEscrowResult {
  verified: boolean;
  contractOrderId: string;
}

export interface AdvanceStateResult {
  txHash: string;
}

export interface ReleasePartialResult {
  txHash: string;
  amount: string;
}

export interface ReleaseFinalResult {
  txHash: string;
  sellerAmount: string;
  feeAmount: string;
}

export interface InitiateDisputeResult {
  txHash: string;
  disputeId: string;
}

export interface RespondDisputeResult {
  txHash: string;
}

export interface ResolveDisputeResult {
  txHash: string;
}

export interface RefundBuyerResult {
  txHash: string;
}

export interface IBlockchainBridge {
  verifyEscrowDeposit(
    txHash: string,
    amount: string,
    buyerWallet: string
  ): Promise<VerifyEscrowResult>;

  advanceState(
    contractOrderId: string,
    newState: string,
    receiptCid: string
  ): Promise<AdvanceStateResult>;

  releasePartial(
    contractOrderId: string,
    percentageBps: number
  ): Promise<ReleasePartialResult>;

  releaseFinal(
    contractOrderId: string,
    platformFeeBps: number
  ): Promise<ReleaseFinalResult>;

  initiateDispute(
    contractOrderId: string,
    evidenceCid: string
  ): Promise<InitiateDisputeResult>;

  respondToDispute(
    disputeId: string,
    accept: boolean,
    evidenceCid?: string
  ): Promise<RespondDisputeResult>;

  resolveDispute(
    disputeId: string,
    resolutionType: "refund" | "release" | "split",
    splitBps?: number
  ): Promise<ResolveDisputeResult>;

  refundBuyer(contractOrderId: string): Promise<RefundBuyerResult>;
}

// ─── Stub implementation ──────────────────────────────────────────────────────

function mockTxHash(): string {
  return `0x${Buffer.from(nanoid(32)).toString("hex").slice(0, 64)}`;
}

export class BlockchainBridgeStub implements IBlockchainBridge {
  async verifyEscrowDeposit(
    _txHash: string,
    _amount: string,
    _buyerWallet: string
  ): Promise<VerifyEscrowResult> {
    console.log(`[blockchain-stub] verifyEscrowDeposit → verified`);
    return {
      verified: true,
      contractOrderId: `contract_ord_${nanoid(10)}`,
    };
  }

  async advanceState(
    contractOrderId: string,
    newState: string,
    _receiptCid: string
  ): Promise<AdvanceStateResult> {
    console.log(`[blockchain-stub] advanceState ${contractOrderId} → ${newState}`);
    return { txHash: mockTxHash() };
  }

  async releasePartial(
    contractOrderId: string,
    percentageBps: number
  ): Promise<ReleasePartialResult> {
    console.log(`[blockchain-stub] releasePartial ${contractOrderId} ${percentageBps} bps`);
    return {
      txHash: mockTxHash(),
      amount: ((100 * percentageBps) / 10000).toFixed(18),
    };
  }

  async releaseFinal(
    contractOrderId: string,
    platformFeeBps: number
  ): Promise<ReleaseFinalResult> {
    console.log(`[blockchain-stub] releaseFinal ${contractOrderId} fee=${platformFeeBps} bps`);
    const feeAmount = ((100 * platformFeeBps) / 10000).toFixed(18);
    const sellerAmount = (100 - parseFloat(feeAmount)).toFixed(18);
    return { txHash: mockTxHash(), sellerAmount, feeAmount };
  }

  async initiateDispute(
    contractOrderId: string,
    _evidenceCid: string
  ): Promise<InitiateDisputeResult> {
    console.log(`[blockchain-stub] initiateDispute for order ${contractOrderId}`);
    return {
      txHash: mockTxHash(),
      disputeId: `contract_dis_${nanoid(10)}`,
    };
  }

  async respondToDispute(
    disputeId: string,
    accept: boolean,
    _evidenceCid?: string
  ): Promise<RespondDisputeResult> {
    console.log(`[blockchain-stub] respondToDispute ${disputeId} accept=${accept}`);
    return { txHash: mockTxHash() };
  }

  async resolveDispute(
    disputeId: string,
    resolutionType: string,
    splitBps?: number
  ): Promise<ResolveDisputeResult> {
    console.log(`[blockchain-stub] resolveDispute ${disputeId} type=${resolutionType} split=${splitBps}`);
    return { txHash: mockTxHash() };
  }

  async refundBuyer(contractOrderId: string): Promise<RefundBuyerResult> {
    console.log(`[blockchain-stub] refundBuyer for order ${contractOrderId}`);
    return { txHash: mockTxHash() };
  }
}
