import { nanoid } from "nanoid";

export function makeOrder(overrides: Record<string, any> = {}) {
  return {
    id: `fs_ord_${nanoid()}`,
    projectId: `fs_proj_${nanoid()}`,
    sellerId: `fs_sel_${nanoid()}`,
    buyerWallet: "0xBuyer1234567890",
    sellerWallet: "0xSeller1234567890",
    state: "INITIATED",
    shippoShipmentId: "shp_test_123",
    trackingNumber: null,
    carrier: null,
    labelUrl: null,
    labelIpfsCid: null,
    selectedRateId: null,
    addressFrom: {
      name: "Sender",
      street1: "123 Main St",
      city: "NYC",
      state: "NY",
      zip: "10001",
      country: "US",
    },
    addressTo: {
      name: "Receiver",
      street1: "456 Oak Ave",
      city: "LA",
      state: "CA",
      zip: "90001",
      country: "US",
    },
    parcel: {
      length: 10,
      width: 8,
      height: 4,
      distanceUnit: "in",
      weight: 2,
      massUnit: "lb",
    },
    subtotalUsd: "100.00",
    shippingCostUsd: null,
    totalUsd: "100.00",
    escrowAmountToken: null,
    exchangeRate: null,
    escrowTxHash: null,
    escrowContractOrderId: null,
    invoiceIpfsCid: null,
    platformFeeBps: 250,
    createdAt: new Date(),
    updatedAt: new Date(),
    escrowedAt: null,
    labelCreatedAt: null,
    shippedAt: null,
    deliveredAt: null,
    graceEndsAt: null,
    finalizedAt: null,
    ...overrides,
  };
}

export function makeSeller(overrides: Record<string, any> = {}) {
  return {
    id: `fs_sel_${nanoid()}`,
    projectId: `fs_proj_${nanoid()}`,
    walletAddress: "0xSeller1234567890",
    businessName: "Test Business",
    businessAddress: {
      street1: "789 Commerce St",
      city: "Chicago",
      state: "IL",
      zip: "60601",
      country: "US",
    },
    carrierAccounts: {},
    payoutConfig: {
      labelCreatedBps: 1500,
      shippedBps: 1500,
      deliveredBps: 3500,
      finalizedBps: 3500,
    },
    reputationScore: 100,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeDispute(overrides: Record<string, any> = {}) {
  return {
    id: `fs_dis_${nanoid()}`,
    orderId: `fs_ord_${nanoid()}`,
    buyerWallet: "0xBuyer1234567890",
    sellerWallet: "0xSeller1234567890",
    status: "OPEN",
    reason: "Item not as described",
    buyerEvidenceCid: "QmBuyerEvidence123",
    sellerEvidenceCid: null,
    frozenAmountToken: "200.000000000000000000",
    contractDisputeId: "contract_dis_test123",
    resolutionType: null,
    resolutionSplitBps: null,
    resolutionTxHash: null,
    sellerDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
    reviewDeadline: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makePayout(overrides: Record<string, any> = {}) {
  return {
    id: `fs_pay_${nanoid()}`,
    orderId: `fs_ord_${nanoid()}`,
    sellerId: `fs_sel_${nanoid()}`,
    state: "LABEL_CREATED",
    amountToken: "30.000000000000000000",
    percentageBps: 1500,
    txHash: "0xmock_payout_tx",
    platformFeeToken: null,
    receiptIpfsCid: "QmReceipt123",
    createdAt: new Date(),
    ...overrides,
  };
}

export function makeProject(overrides: Record<string, any> = {}) {
  return {
    id: `fs_proj_${nanoid()}`,
    name: "Test Project",
    ownerEmail: "test@example.com",
    platformFeeWallet: "0xPlatform123",
    platformFeeBps: 250,
    contracts: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeApiKey(overrides: Record<string, any> = {}) {
  return {
    id: `fs_key_${nanoid()}`,
    projectId: `fs_proj_${nanoid()}`,
    keyHash: "mock_hash_abcdef1234567890",
    keyPrefix: "fs_live_key_abc",
    label: "default",
    isActive: true,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
