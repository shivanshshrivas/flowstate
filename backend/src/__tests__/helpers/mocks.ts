import { vi } from "vitest";
import type { IShippoBridge } from "../../bridges/shippo.bridge";
import type { IPinataBridge } from "../../bridges/pinata.bridge";
import type { IBlockchainBridge } from "../../bridges/blockchain.bridge";

export function createMockShippoBridge(): IShippoBridge {
  return {
    getRates: vi.fn().mockResolvedValue({
      shipmentId: "shp_mock_123",
      rates: [
        {
          rateId: "rate_1",
          carrier: "USPS",
          service: "Priority",
          days: 3,
          amountUSD: "7.50",
          currency: "USD",
        },
      ],
    }),
    purchaseLabel: vi.fn().mockResolvedValue({
      transactionId: "txn_mock_123",
      trackingNumber: "TRACK123456",
      trackingUrlProvider: "https://track.example.com/TRACK123456",
      carrier: "usps",
      labelUrl: "https://labels.example.com/label.pdf",
      shippingCostUsd: "7.50",
    }),
    getTrackingStatus: vi.fn().mockResolvedValue({
      carrier: "usps",
      trackingNumber: "TRACK123456",
      status: "TRANSIT",
      substatus: null,
      statusDetails: "In transit",
      eta: null,
      history: [],
      escrowEvent: { escrowEvent: "SHIPPED", shouldAdvance: true },
    }),
    handleWebhook: vi.fn().mockResolvedValue({
      handled: true,
      trackingNumber: "TRACK123456",
      carrier: "usps",
      status: "TRANSIT",
      substatus: null,
      statusDetails: "In transit",
      escrowEvent: "SHIPPED",
      shouldAdvance: true,
    }),
  };
}

export function createMockPinataBridge(): IPinataBridge {
  return {
    pinJSON: vi
      .fn()
      .mockResolvedValue("QmMockJSON123456789012345678901234567890"),
    pinFile: vi
      .fn()
      .mockResolvedValue("QmMockFile123456789012345678901234567890"),
    getGatewayUrl: vi
      .fn()
      .mockImplementation(
        (cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`,
      ),
  };
}

export function createMockBlockchainBridge(): IBlockchainBridge {
  return {
    verifyEscrowDeposit: vi.fn().mockResolvedValue({
      verified: true,
      contractOrderId: "contract_ord_mock123",
    }),
    advanceState: vi.fn().mockResolvedValue({ txHash: "0xmock_advance_tx" }),
    releasePartial: vi
      .fn()
      .mockResolvedValue({
        txHash: "0xmock_release_tx",
        amount: "15.000000000000000000",
      }),
    releaseFinal: vi.fn().mockResolvedValue({
      txHash: "0xmock_final_tx",
      sellerAmount: "97.500000000000000000",
      feeAmount: "2.500000000000000000",
    }),
    initiateDispute: vi.fn().mockResolvedValue({
      txHash: "0xmock_dispute_tx",
      disputeId: "contract_dis_mock123",
    }),
    respondToDispute: vi
      .fn()
      .mockResolvedValue({ txHash: "0xmock_respond_tx" }),
    resolveDispute: vi.fn().mockResolvedValue({ txHash: "0xmock_resolve_tx" }),
    refundBuyer: vi.fn().mockResolvedValue({ txHash: "0xmock_refund_tx" }),
  };
}

/**
 * Creates a mock drizzle DB with chainable query builder methods.
 * Each method returns `mockDb` so calls like db.select().from().where() can be chained.
 */
export function createMockDb() {
  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    _mockResults: [] as any[],
  };

  return mockDb;
}
