/**
 * Mock FlowState Backend API — simulates api.flowstate.xyz in-memory.
 */
import { OrderState } from "@/lib/flowstate/types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface MockOrder {
  id: string;
  buyer_wallet: string;
  seller_id: string;
  seller_name: string;
  state: string;
  total_usd: number;
  total_token: string;
  items: { product_id: string; product_name: string; quantity: number; price_usd: number }[];
  tracking_number?: string;
  carrier?: string;
  label_url?: string;
  escrow?: {
    escrowId: string; contractAddress: string; tokenAddress: string;
    totalAmount: string; remainingAmount: string;
    txHash: string; blockNumber: number; createdAt: string;
  };
  payout_schedule: {
    state: string; percentageBps: number; label: string;
    releasedAt?: string; txHash?: string; amountToken?: string;
  }[];
  shipping_address: { name: string; address1: string; city: string; state: string; zip: string; country: string };
  state_history: { from: string; to: string; timestamp: string; txHash?: string; triggeredBy: string; notes?: string }[];
  created_at: string; updated_at: string;
}

export interface MockSeller {
  id: string; business_name: string; wallet_address: string; email: string;
  status: "active" | "suspended" | "pending"; created_at: string;
  address: { name: string; address1: string; city: string; state: string; zip: string; country: string };
  payout_config: { immediate_bps: number; milestone_bps: number; holdback_bps: number };
}

export interface MockSellerMetrics {
  total_orders: number; total_revenue_usd: number; total_revenue_token: string;
  fulfillment_avg_hours: number; dispute_rate: number;
  active_escrows: number; pending_payouts_token: string;
}

export interface MockPayoutRecord {
  id: string; order_id: string; state: string;
  amount_token: string; amount_usd: number; tx_hash?: string; timestamp: string;
}

export interface TrackingInfo {
  order_id: string; tracking_number: string; carrier: string;
  current_status: string; current_location: string; estimated_delivery: string;
  history: { timestamp: string; location: string; status: string; description: string }[];
}

export interface GasReport {
  total_gas_spent_xrp: number; avg_gas_per_transition_xrp: number; total_transitions: number;
  costs_by_function: { function_name: string; call_count: number; total_gas_xrp: number; avg_gas_xrp: number }[];
  daily_gas: { date: string; gas_xrp: number; transitions: number }[];
}

// ── Mock Orders ────────────────────────────────────────────────────────────

const ORDERS: MockOrder[] = [
  {
    id: "order-001", buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-001", seller_name: "TechGear Co.",
    state: OrderState.SHIPPED, total_usd: 159.98, total_token: "159980000000000000000",
    items: [{ product_id: "prod-001", product_name: "Mechanical Keyboard – TKL Pro", quantity: 1, price_usd: 149.99 }],
    tracking_number: "9400111899221234567890", carrier: "USPS",
    escrow: { escrowId: "escrow-001", contractAddress: "0x0000000000000000000000000000000000000001", tokenAddress: "0x0000000000000000000000000000000000000002", totalAmount: "159980000000000000000", remainingAmount: "111986000000000000000", txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", blockNumber: 12345678, createdAt: "2025-12-09T12:00:00Z" },
    payout_schedule: [
      { state: OrderState.LABEL_CREATED, percentageBps: 1500, label: "Label Printed (15%)", releasedAt: "2025-12-10T14:00:00Z", txHash: "0xabc123", amountToken: "23997000000000000000" },
      { state: OrderState.SHIPPED, percentageBps: 1500, label: "Shipped (15%)", releasedAt: "2025-12-11T10:00:00Z", txHash: "0xdef456", amountToken: "23997000000000000000" },
      { state: OrderState.IN_TRANSIT, percentageBps: 2000, label: "In Transit (20%)" },
      { state: OrderState.DELIVERED, percentageBps: 3500, label: "Delivered (35%)" },
      { state: OrderState.FINALIZED, percentageBps: 1500, label: "Finalized (15%)" },
    ],
    shipping_address: { name: "Alex Buyer", address1: "100 Main St", city: "Austin", state: "TX", zip: "78701", country: "US" },
    state_history: [
      { from: OrderState.INITIATED, to: OrderState.ESCROWED, timestamp: "2025-12-09T12:01:00Z", txHash: "0x1234567890abcdef", triggeredBy: "buyer" },
      { from: OrderState.ESCROWED, to: OrderState.LABEL_CREATED, timestamp: "2025-12-10T14:00:00Z", txHash: "0xabc123", triggeredBy: "seller" },
      { from: OrderState.LABEL_CREATED, to: OrderState.SHIPPED, timestamp: "2025-12-11T10:00:00Z", txHash: "0xdef456", triggeredBy: "system" },
    ],
    created_at: "2025-12-09T12:00:00Z", updated_at: "2025-12-11T10:30:00Z",
  },
  {
    id: "order-002", buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-002", seller_name: "HomeWork Studio",
    state: OrderState.DELIVERED, total_usd: 184.99, total_token: "184990000000000000000",
    items: [{ product_id: "prod-005", product_name: "Leather Laptop Bag", quantity: 1, price_usd: 179.0 }],
    tracking_number: "1Z999AA10123456784", carrier: "UPS",
    escrow: { escrowId: "escrow-002", contractAddress: "0x0000000000000000000000000000000000000001", tokenAddress: "0x0000000000000000000000000000000000000002", totalAmount: "184990000000000000000", remainingAmount: "27748500000000000000", txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", blockNumber: 12345900, createdAt: "2025-12-01T09:00:00Z" },
    payout_schedule: [
      { state: OrderState.LABEL_CREATED, percentageBps: 1500, label: "Label Printed (15%)", releasedAt: "2025-12-02T11:00:00Z", txHash: "0xaaa111", amountToken: "27748500000000000000" },
      { state: OrderState.SHIPPED, percentageBps: 1500, label: "Shipped (15%)", releasedAt: "2025-12-03T09:00:00Z", txHash: "0xbbb222", amountToken: "27748500000000000000" },
      { state: OrderState.IN_TRANSIT, percentageBps: 2000, label: "In Transit (20%)", releasedAt: "2025-12-04T14:00:00Z", txHash: "0xccc333", amountToken: "36998000000000000000" },
      { state: OrderState.DELIVERED, percentageBps: 3500, label: "Delivered (35%)", releasedAt: "2025-12-06T10:00:00Z", txHash: "0xddd444", amountToken: "64746500000000000000" },
      { state: OrderState.FINALIZED, percentageBps: 1500, label: "Finalized (15%)" },
    ],
    shipping_address: { name: "Alex Buyer", address1: "100 Main St", city: "Austin", state: "TX", zip: "78701", country: "US" },
    state_history: [
      { from: OrderState.INITIATED, to: OrderState.ESCROWED, timestamp: "2025-12-01T09:01:00Z", triggeredBy: "buyer" },
      { from: OrderState.ESCROWED, to: OrderState.LABEL_CREATED, timestamp: "2025-12-02T11:00:00Z", triggeredBy: "seller" },
      { from: OrderState.LABEL_CREATED, to: OrderState.SHIPPED, timestamp: "2025-12-03T09:00:00Z", triggeredBy: "system" },
      { from: OrderState.SHIPPED, to: OrderState.IN_TRANSIT, timestamp: "2025-12-04T14:00:00Z", triggeredBy: "oracle" },
      { from: OrderState.IN_TRANSIT, to: OrderState.DELIVERED, timestamp: "2025-12-06T10:00:00Z", triggeredBy: "oracle" },
    ],
    created_at: "2025-12-01T09:00:00Z", updated_at: "2025-12-06T10:30:00Z",
  },
  {
    id: "order-003", buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-001", seller_name: "TechGear Co.",
    state: OrderState.INITIATED, total_usd: 163.97, total_token: "163970000000000000000",
    items: [
      { product_id: "prod-004", product_name: "4K Webcam – StreamPro", quantity: 1, price_usd: 89.99 },
      { product_id: "prod-009", product_name: "USB-C Hub – 10-in-1", quantity: 1, price_usd: 64.99 },
    ],
    payout_schedule: [
      { state: OrderState.LABEL_CREATED, percentageBps: 1500, label: "Label Printed (15%)" },
      { state: OrderState.SHIPPED, percentageBps: 1500, label: "Shipped (15%)" },
      { state: OrderState.IN_TRANSIT, percentageBps: 2000, label: "In Transit (20%)" },
      { state: OrderState.DELIVERED, percentageBps: 3500, label: "Delivered (35%)" },
      { state: OrderState.FINALIZED, percentageBps: 1500, label: "Finalized (15%)" },
    ],
    shipping_address: { name: "Alex Buyer", address1: "100 Main St", city: "Austin", state: "TX", zip: "78701", country: "US" },
    state_history: [], created_at: "2025-12-12T08:00:00Z", updated_at: "2025-12-12T08:00:00Z",
  },
  {
    id: "order-004", buyer_wallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    seller_id: "seller-001", seller_name: "TechGear Co.",
    state: OrderState.ESCROWED, total_usd: 258.99, total_token: "258990000000000000000",
    items: [{ product_id: "prod-002", product_name: "Noise Cancelling Headphones", quantity: 1, price_usd: 249.0 }],
    escrow: { escrowId: "escrow-004", contractAddress: "0x0000000000000000000000000000000000000001", tokenAddress: "0x0000000000000000000000000000000000000002", totalAmount: "258990000000000000000", remainingAmount: "258990000000000000000", txHash: "0xeeee1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab", blockNumber: 12346100, createdAt: "2025-12-11T16:00:00Z" },
    payout_schedule: [
      { state: OrderState.LABEL_CREATED, percentageBps: 1500, label: "Label Printed (15%)" },
      { state: OrderState.SHIPPED, percentageBps: 1500, label: "Shipped (15%)" },
      { state: OrderState.IN_TRANSIT, percentageBps: 2000, label: "In Transit (20%)" },
      { state: OrderState.DELIVERED, percentageBps: 3500, label: "Delivered (35%)" },
      { state: OrderState.FINALIZED, percentageBps: 1500, label: "Finalized (15%)" },
    ],
    shipping_address: { name: "Jordan Smith", address1: "45 Park Ave", city: "New York", state: "NY", zip: "10016", country: "US" },
    state_history: [{ from: OrderState.INITIATED, to: OrderState.ESCROWED, timestamp: "2025-12-11T16:05:00Z", txHash: "0xeeee1234", triggeredBy: "buyer" }],
    created_at: "2025-12-11T16:00:00Z", updated_at: "2025-12-11T16:05:00Z",
  },
  {
    id: "order-005", buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-002", seller_name: "HomeWork Studio",
    state: OrderState.IN_TRANSIT, total_usd: 253.99, total_token: "253990000000000000000",
    items: [{ product_id: "prod-006", product_name: "Standing Desk Converter", quantity: 1, price_usd: 229.0 }],
    tracking_number: "783213374523", carrier: "FedEx", label_url: "https://example.com/label-005.pdf",
    escrow: { escrowId: "escrow-005", contractAddress: "0x0000000000000000000000000000000000000001", tokenAddress: "0x0000000000000000000000000000000000000002", totalAmount: "253990000000000000000", remainingAmount: "126995000000000000000", txHash: "0xffff5678abcdef1234567890abcdef1234567890abcdef1234567890abcdef12", blockNumber: 12346200, createdAt: "2025-12-08T10:00:00Z" },
    payout_schedule: [
      { state: OrderState.LABEL_CREATED, percentageBps: 1500, label: "Label Printed (15%)", releasedAt: "2025-12-08T18:00:00Z", txHash: "0xfffa001", amountToken: "38098500000000000000" },
      { state: OrderState.SHIPPED, percentageBps: 1500, label: "Shipped (15%)", releasedAt: "2025-12-09T08:00:00Z", txHash: "0xfffb002", amountToken: "38098500000000000000" },
      { state: OrderState.IN_TRANSIT, percentageBps: 2000, label: "In Transit (20%)" },
      { state: OrderState.DELIVERED, percentageBps: 3500, label: "Delivered (35%)" },
      { state: OrderState.FINALIZED, percentageBps: 1500, label: "Finalized (15%)" },
    ],
    shipping_address: { name: "Alex Buyer", address1: "100 Main St", city: "Austin", state: "TX", zip: "78701", country: "US" },
    state_history: [
      { from: OrderState.INITIATED, to: OrderState.ESCROWED, timestamp: "2025-12-08T10:02:00Z", txHash: "0xffff5678", triggeredBy: "buyer" },
      { from: OrderState.ESCROWED, to: OrderState.LABEL_CREATED, timestamp: "2025-12-08T18:00:00Z", txHash: "0xfffa001", triggeredBy: "seller" },
      { from: OrderState.LABEL_CREATED, to: OrderState.SHIPPED, timestamp: "2025-12-09T08:00:00Z", txHash: "0xfffb002", triggeredBy: "system" },
      { from: OrderState.SHIPPED, to: OrderState.IN_TRANSIT, timestamp: "2025-12-10T14:00:00Z", triggeredBy: "oracle" },
    ],
    created_at: "2025-12-08T10:00:00Z", updated_at: "2025-12-10T14:00:00Z",
  },
  {
    id: "order-006", buyer_wallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    seller_id: "seller-001", seller_name: "TechGear Co.",
    state: OrderState.FINALIZED, total_usd: 78.97, total_token: "78970000000000000000",
    items: [{ product_id: "prod-007", product_name: "Wireless Charging Pad", quantity: 2, price_usd: 34.99 }],
    tracking_number: "94001118992212345099", carrier: "USPS",
    escrow: { escrowId: "escrow-006", contractAddress: "0x0000000000000000000000000000000000000001", tokenAddress: "0x0000000000000000000000000000000000000002", totalAmount: "78970000000000000000", remainingAmount: "0", txHash: "0xaaaa9876543210fedcba9876543210fedcba9876543210fedcba9876543210fe", blockNumber: 12344000, createdAt: "2025-11-20T08:00:00Z" },
    payout_schedule: [
      { state: OrderState.LABEL_CREATED, percentageBps: 1500, label: "Label Printed (15%)", releasedAt: "2025-11-21T09:00:00Z", txHash: "0xaaa001", amountToken: "11845500000000000000" },
      { state: OrderState.SHIPPED, percentageBps: 1500, label: "Shipped (15%)", releasedAt: "2025-11-22T10:00:00Z", txHash: "0xaaa002", amountToken: "11845500000000000000" },
      { state: OrderState.IN_TRANSIT, percentageBps: 2000, label: "In Transit (20%)", releasedAt: "2025-11-24T12:00:00Z", txHash: "0xaaa003", amountToken: "15794000000000000000" },
      { state: OrderState.DELIVERED, percentageBps: 3500, label: "Delivered (35%)", releasedAt: "2025-11-26T14:00:00Z", txHash: "0xaaa004", amountToken: "27639500000000000000" },
      { state: OrderState.FINALIZED, percentageBps: 1500, label: "Finalized (15%)", releasedAt: "2025-11-28T10:00:00Z", txHash: "0xaaa005", amountToken: "11845500000000000000" },
    ],
    shipping_address: { name: "Sam Chen", address1: "200 Oak Street", city: "Seattle", state: "WA", zip: "98101", country: "US" },
    state_history: [
      { from: OrderState.INITIATED, to: OrderState.ESCROWED, timestamp: "2025-11-20T08:02:00Z", txHash: "0xaaaa9876", triggeredBy: "buyer" },
      { from: OrderState.ESCROWED, to: OrderState.LABEL_CREATED, timestamp: "2025-11-21T09:00:00Z", txHash: "0xaaa001", triggeredBy: "seller" },
      { from: OrderState.LABEL_CREATED, to: OrderState.SHIPPED, timestamp: "2025-11-22T10:00:00Z", txHash: "0xaaa002", triggeredBy: "system" },
      { from: OrderState.SHIPPED, to: OrderState.IN_TRANSIT, timestamp: "2025-11-24T12:00:00Z", triggeredBy: "oracle" },
      { from: OrderState.IN_TRANSIT, to: OrderState.DELIVERED, timestamp: "2025-11-26T14:00:00Z", triggeredBy: "oracle" },
      { from: OrderState.DELIVERED, to: OrderState.FINALIZED, timestamp: "2025-11-28T10:00:00Z", txHash: "0xaaa005", triggeredBy: "buyer" },
    ],
    created_at: "2025-11-20T08:00:00Z", updated_at: "2025-11-28T10:05:00Z",
  },
  {
    id: "order-007", buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-002", seller_name: "HomeWork Studio",
    state: OrderState.DISPUTED, total_usd: 407.49, total_token: "407490000000000000000",
    items: [{ product_id: "prod-003", product_name: "Ergonomic Office Chair", quantity: 1, price_usd: 399.0 }],
    tracking_number: "783219876543", carrier: "FedEx",
    escrow: { escrowId: "escrow-007", contractAddress: "0x0000000000000000000000000000000000000001", tokenAddress: "0x0000000000000000000000000000000000000002", totalAmount: "407490000000000000000", remainingAmount: "244494000000000000000", txHash: "0xbbbb1111222233334444555566667777888899990000aaaabbbbccccddddeeee", blockNumber: 12345500, createdAt: "2025-12-04T10:00:00Z" },
    payout_schedule: [
      { state: OrderState.LABEL_CREATED, percentageBps: 1500, label: "Label Printed (15%)", releasedAt: "2025-12-05T09:00:00Z", txHash: "0xbbb001", amountToken: "61123500000000000000" },
      { state: OrderState.SHIPPED, percentageBps: 1500, label: "Shipped (15%)", releasedAt: "2025-12-06T08:00:00Z", txHash: "0xbbb002", amountToken: "61123500000000000000" },
      { state: OrderState.IN_TRANSIT, percentageBps: 2000, label: "In Transit (20%)", releasedAt: "2025-12-07T12:00:00Z", txHash: "0xbbb003", amountToken: "81498000000000000000" },
      { state: OrderState.DELIVERED, percentageBps: 3500, label: "Delivered (35%)" },
      { state: OrderState.FINALIZED, percentageBps: 1500, label: "Finalized (15%)" },
    ],
    shipping_address: { name: "Alex Buyer", address1: "100 Main St", city: "Austin", state: "TX", zip: "78701", country: "US" },
    state_history: [
      { from: OrderState.INITIATED, to: OrderState.ESCROWED, timestamp: "2025-12-04T10:02:00Z", txHash: "0xbbbb1111", triggeredBy: "buyer" },
      { from: OrderState.ESCROWED, to: OrderState.LABEL_CREATED, timestamp: "2025-12-05T09:00:00Z", txHash: "0xbbb001", triggeredBy: "seller" },
      { from: OrderState.LABEL_CREATED, to: OrderState.SHIPPED, timestamp: "2025-12-06T08:00:00Z", txHash: "0xbbb002", triggeredBy: "system" },
      { from: OrderState.SHIPPED, to: OrderState.IN_TRANSIT, timestamp: "2025-12-07T12:00:00Z", triggeredBy: "oracle" },
      { from: OrderState.IN_TRANSIT, to: OrderState.DISPUTED, timestamp: "2025-12-09T11:00:00Z", triggeredBy: "buyer", notes: "Item arrived damaged — cracked armrest" },
    ],
    created_at: "2025-12-04T10:00:00Z", updated_at: "2025-12-09T11:00:00Z",
  },
  {
    id: "order-008", buyer_wallet: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    seller_id: "seller-002", seller_name: "HomeWork Studio",
    state: OrderState.LABEL_CREATED, total_usd: 148.48, total_token: "148480000000000000000",
    items: [
      { product_id: "prod-008", product_name: "Smart LED Desk Lamp", quantity: 1, price_usd: 59.99 },
      { product_id: "prod-010", product_name: "Artisan Coffee Mug Set", quantity: 1, price_usd: 79.0 },
    ],
    tracking_number: "9400111899221234599012", carrier: "USPS", label_url: "https://example.com/label-008.pdf",
    escrow: { escrowId: "escrow-008", contractAddress: "0x0000000000000000000000000000000000000001", tokenAddress: "0x0000000000000000000000000000000000000002", totalAmount: "148480000000000000000", remainingAmount: "126208000000000000000", txHash: "0xcccc9999888877776666555544443333222211110000ffffeeee", blockNumber: 12346350, createdAt: "2025-12-12T06:00:00Z" },
    payout_schedule: [
      { state: OrderState.LABEL_CREATED, percentageBps: 1500, label: "Label Printed (15%)", releasedAt: "2025-12-12T14:00:00Z", txHash: "0xccc001", amountToken: "22272000000000000000" },
      { state: OrderState.SHIPPED, percentageBps: 1500, label: "Shipped (15%)" },
      { state: OrderState.IN_TRANSIT, percentageBps: 2000, label: "In Transit (20%)" },
      { state: OrderState.DELIVERED, percentageBps: 3500, label: "Delivered (35%)" },
      { state: OrderState.FINALIZED, percentageBps: 1500, label: "Finalized (15%)" },
    ],
    shipping_address: { name: "Taylor Wong", address1: "789 Elm Drive", city: "Portland", state: "OR", zip: "97201", country: "US" },
    state_history: [
      { from: OrderState.INITIATED, to: OrderState.ESCROWED, timestamp: "2025-12-12T06:02:00Z", txHash: "0xcccc9999", triggeredBy: "buyer" },
      { from: OrderState.ESCROWED, to: OrderState.LABEL_CREATED, timestamp: "2025-12-12T14:00:00Z", txHash: "0xccc001", triggeredBy: "seller" },
    ],
    created_at: "2025-12-12T06:00:00Z", updated_at: "2025-12-12T14:00:00Z",
  },
];

// ── Sellers ────────────────────────────────────────────────────────────────

const SELLERS: MockSeller[] = [
  { id: "seller-001", business_name: "TechGear Co.", wallet_address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", email: "seller@techgear.io", status: "active", created_at: "2025-10-15T00:00:00Z", address: { name: "TechGear Co.", address1: "123 Tech Blvd", city: "San Francisco", state: "CA", zip: "94101", country: "US" }, payout_config: { immediate_bps: 3000, milestone_bps: 5500, holdback_bps: 1500 } },
  { id: "seller-002", business_name: "HomeWork Studio", wallet_address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", email: "seller@homework.studio", status: "active", created_at: "2025-11-01T00:00:00Z", address: { name: "HomeWork Studio", address1: "456 Design Ave", city: "Brooklyn", state: "NY", zip: "11201", country: "US" }, payout_config: { immediate_bps: 3000, milestone_bps: 5500, holdback_bps: 1500 } },
  { id: "seller-003", business_name: "QuickShip Electronics", wallet_address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9", email: "seller@quickship.io", status: "active", created_at: "2025-10-01T00:00:00Z", address: { name: "QuickShip Electronics", address1: "999 Commerce Dr", city: "Miami", state: "FL", zip: "33101", country: "US" }, payout_config: { immediate_bps: 3000, milestone_bps: 5500, holdback_bps: 1500 } },
  { id: "seller-004", business_name: "Budget Gadgets", wallet_address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", email: "seller@budgetgadgets.com", status: "suspended", created_at: "2025-09-15T00:00:00Z", address: { name: "Budget Gadgets", address1: "42 Low St", city: "Phoenix", state: "AZ", zip: "85001", country: "US" }, payout_config: { immediate_bps: 3000, milestone_bps: 5500, holdback_bps: 1500 } },
];

const SELLER_METRICS: Record<string, MockSellerMetrics> = {
  "seller-001": { total_orders: 47, total_revenue_usd: 12840.0, total_revenue_token: "12840000000000000000000", fulfillment_avg_hours: 18.3, dispute_rate: 0.021, active_escrows: 6, pending_payouts_token: "1284000000000000000000" },
  "seller-002": { total_orders: 31, total_revenue_usd: 9210.0, total_revenue_token: "9210000000000000000000", fulfillment_avg_hours: 22.1, dispute_rate: 0.032, active_escrows: 4, pending_payouts_token: "921000000000000000000" },
  "seller-003": { total_orders: 89, total_revenue_usd: 22450.0, total_revenue_token: "22450000000000000000000", fulfillment_avg_hours: 14.2, dispute_rate: 0.011, active_escrows: 8, pending_payouts_token: "2245000000000000000000" },
  "seller-004": { total_orders: 12, total_revenue_usd: 1480.0, total_revenue_token: "1480000000000000000000", fulfillment_avg_hours: 56.8, dispute_rate: 0.167, active_escrows: 0, pending_payouts_token: "0" },
};

const PAYOUTS: MockPayoutRecord[] = [
  { id: "payout-001", order_id: "order-001", state: OrderState.LABEL_CREATED, amount_token: "23997000000000000000", amount_usd: 23.99, tx_hash: "0xabc123", timestamp: "2025-12-10T14:00:00Z" },
  { id: "payout-002", order_id: "order-001", state: OrderState.SHIPPED, amount_token: "23997000000000000000", amount_usd: 23.99, tx_hash: "0xdef456", timestamp: "2025-12-11T10:00:00Z" },
  { id: "payout-003", order_id: "order-006", state: OrderState.FINALIZED, amount_token: "11845500000000000000", amount_usd: 11.85, tx_hash: "0xaaa005", timestamp: "2025-11-28T10:00:00Z" },
  { id: "payout-004", order_id: "order-005", state: OrderState.LABEL_CREATED, amount_token: "38098500000000000000", amount_usd: 38.1, tx_hash: "0xfffa001", timestamp: "2025-12-08T18:00:00Z" },
  { id: "payout-005", order_id: "order-005", state: OrderState.SHIPPED, amount_token: "38098500000000000000", amount_usd: 38.1, tx_hash: "0xfffb002", timestamp: "2025-12-09T08:00:00Z" },
  { id: "payout-006", order_id: "order-008", state: OrderState.LABEL_CREATED, amount_token: "22272000000000000000", amount_usd: 22.27, tx_hash: "0xccc001", timestamp: "2025-12-12T14:00:00Z" },
];

const TRACKING: Record<string, TrackingInfo> = {
  "order-001": { order_id: "order-001", tracking_number: "9400111899221234567890", carrier: "USPS", current_status: "In Transit", current_location: "USPS Dallas Distribution Center, TX", estimated_delivery: "2025-12-14", history: [{ timestamp: "2025-12-11T10:00:00Z", location: "San Francisco, CA", status: "Shipped", description: "Picked up by USPS" }, { timestamp: "2025-12-11T20:00:00Z", location: "Los Angeles, CA", status: "In Transit", description: "Arrived at sorting facility" }, { timestamp: "2025-12-12T08:00:00Z", location: "Dallas, TX", status: "In Transit", description: "In transit to destination" }] },
  "order-005": { order_id: "order-005", tracking_number: "783213374523", carrier: "FedEx", current_status: "In Transit", current_location: "FedEx Memphis Hub, TN", estimated_delivery: "2025-12-13", history: [{ timestamp: "2025-12-09T08:00:00Z", location: "Brooklyn, NY", status: "Shipped", description: "Package picked up" }, { timestamp: "2025-12-09T22:00:00Z", location: "Memphis, TN", status: "In Transit", description: "Arrived at hub" }, { timestamp: "2025-12-10T14:00:00Z", location: "Memphis, TN", status: "In Transit", description: "Departed hub, en route to Austin, TX" }] },
  "order-007": { order_id: "order-007", tracking_number: "783219876543", carrier: "FedEx", current_status: "Delivered", current_location: "Austin, TX (100 Main St)", estimated_delivery: "2025-12-09", history: [{ timestamp: "2025-12-06T08:00:00Z", location: "Brooklyn, NY", status: "Shipped", description: "Package picked up" }, { timestamp: "2025-12-07T14:00:00Z", location: "Memphis, TN", status: "In Transit", description: "Arrived at hub" }, { timestamp: "2025-12-09T09:30:00Z", location: "Austin, TX", status: "Delivered", description: "Delivered to front door" }] },
};

const DISPUTES = [
  { id: "dispute-001", order_id: "order-007", buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", seller_id: "seller-002", status: "OPEN", buyer_evidence: { description: "The ergonomic chair arrived with a cracked armrest and bent backrest rod. Packaging was intact — manufacturing defect.", ipfs_cid: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco", submitted_at: "2025-12-09T11:00:00Z" }, deadline: "2025-12-12T11:00:00Z", created_at: "2025-12-09T11:00:00Z" },
];

const WEBHOOK_EVENTS = [
  { id: "wh-001", event_type: "order.escrowed", source: "contract", order_id: "order-001", status: "processed", http_status: 200, timestamp: "2025-12-09T12:01:10Z" },
  { id: "wh-002", event_type: "order.state_advanced", source: "contract", order_id: "order-001", status: "processed", http_status: 200, timestamp: "2025-12-10T14:00:10Z" },
  { id: "wh-003", event_type: "shipping.label_created", source: "shippo", order_id: "order-005", status: "processed", http_status: 200, timestamp: "2025-12-08T18:00:05Z" },
  { id: "wh-004", event_type: "shipping.delivered", source: "shippo", order_id: "order-002", status: "processed", http_status: 200, timestamp: "2025-12-06T10:00:08Z" },
  { id: "wh-005", event_type: "dispute.created", source: "contract", order_id: "order-007", status: "processed", http_status: 200, timestamp: "2025-12-09T11:00:05Z" },
  { id: "wh-006", event_type: "order.escrowed", source: "contract", order_id: "order-004", status: "processed", http_status: 200, timestamp: "2025-12-11T16:05:10Z" },
  { id: "wh-007", event_type: "order.state_advanced", source: "contract", order_id: "order-008", status: "failed", http_status: 503, timestamp: "2025-12-12T14:00:08Z" },
];

const GAS_REPORT: GasReport = {
  total_gas_spent_xrp: 4.782, avg_gas_per_transition_xrp: 0.019, total_transitions: 252,
  costs_by_function: [
    { function_name: "transferAndEscrow", call_count: 89, total_gas_xrp: 1.602, avg_gas_xrp: 0.018 },
    { function_name: "advanceState", call_count: 124, total_gas_xrp: 1.984, avg_gas_xrp: 0.016 },
    { function_name: "releasePartial", call_count: 28, total_gas_xrp: 0.756, avg_gas_xrp: 0.027 },
    { function_name: "createDispute", call_count: 6, total_gas_xrp: 0.282, avg_gas_xrp: 0.047 },
    { function_name: "resolveDispute", call_count: 5, total_gas_xrp: 0.158, avg_gas_xrp: 0.032 },
  ],
  daily_gas: [
    { date: "2025-12-06", gas_xrp: 0.582, transitions: 32 }, { date: "2025-12-07", gas_xrp: 0.634, transitions: 35 },
    { date: "2025-12-08", gas_xrp: 0.714, transitions: 39 }, { date: "2025-12-09", gas_xrp: 0.698, transitions: 37 },
    { date: "2025-12-10", gas_xrp: 0.823, transitions: 44 }, { date: "2025-12-11", gas_xrp: 0.741, transitions: 40 },
    { date: "2025-12-12", gas_xrp: 0.59, transitions: 25 },
  ],
};

const ANALYTICS = {
  total_orders: 242, total_volume_usd: 52340.0, active_escrows: 14,
  dispute_rate: 0.016, avg_resolution_hours: 13.8,
  orders_by_day: [
    { date: "2025-12-06", count: 14, volume_usd: 2980.8 }, { date: "2025-12-07", count: 18, volume_usd: 4210.5 },
    { date: "2025-12-08", count: 16, volume_usd: 3540.0 }, { date: "2025-12-09", count: 22, volume_usd: 5110.3 },
    { date: "2025-12-10", count: 19, volume_usd: 4380.0 }, { date: "2025-12-11", count: 24, volume_usd: 5920.8 },
    { date: "2025-12-12", count: 11, volume_usd: 2640.2 },
  ],
};

// ── API Functions ──────────────────────────────────────────────────────────

export function getOrder(id: string): MockOrder | null { return ORDERS.find((o) => o.id === id) ?? null; }
export function listOrdersByBuyer(wallet: string): MockOrder[] { return ORDERS.filter((o) => o.buyer_wallet.toLowerCase() === wallet.toLowerCase()); }

export function getTrackingInfo(orderId: string): TrackingInfo | null {
  if (TRACKING[orderId]) return TRACKING[orderId];
  const order = getOrder(orderId);
  if (!order?.tracking_number) return null;
  return { order_id: orderId, tracking_number: order.tracking_number, carrier: order.carrier ?? "Unknown", current_status: order.state, current_location: "Unknown", estimated_delivery: "TBD", history: [] };
}

export function fileDispute(orderId: string, _buyerWallet: string, _reason: string) {
  const order = getOrder(orderId);
  if (!order) throw new Error(`Order ${orderId} not found`);
  return { dispute_id: `dispute-${Date.now()}`, frozen_amount: order.escrow?.remainingAmount ?? "0", seller_deadline: new Date(Date.now() + 72 * 3600 * 1000).toISOString(), message: `Dispute filed for order ${orderId}. Seller has 72 hours to respond.` };
}

export function getReceipt(orderId: string) {
  const order = getOrder(orderId);
  if (!order) return null;
  return { order_id: order.id, buyer_wallet: order.buyer_wallet, items: order.items.map((i) => ({ name: i.product_name, qty: i.quantity, price_usd: i.price_usd })), total_usd: order.total_usd, total_token: order.total_token, escrow_tx: order.escrow?.txHash, invoice_url: `https://ipfs.io/ipfs/QmInvoice${order.id.replace("-", "")}`, created_at: order.created_at };
}

export function listOrdersBySeller(sellerId: string, status?: string): MockOrder[] {
  let orders = ORDERS.filter((o) => o.seller_id === sellerId);
  if (status) orders = orders.filter((o) => o.state === status);
  return orders;
}

export function getSellerMetrics(sellerId: string): MockSellerMetrics | null { return SELLER_METRICS[sellerId] ?? null; }

export function confirmLabel(orderId: string) {
  const order = getOrder(orderId);
  if (!order) throw new Error(`Order ${orderId} not found`);
  const payout = order.payout_schedule.find((p) => p.state === OrderState.LABEL_CREATED);
  return { success: true, new_state: "LABEL_CREATED", payout_released_token: payout?.amountToken ?? "0", payout_released_usd: Number(payout?.amountToken ?? "0") / 1e18, tx_hash: `0x${Math.random().toString(16).slice(2)}` };
}

export function respondToDispute(disputeId: string, _sellerId: string, _response: string) {
  return { success: true, dispute_id: disputeId, new_status: "SELLER_RESPONDED", message: `Response recorded for ${disputeId}. Admin reviews within 48 hours.` };
}

export function getPayouts(sellerId: string): MockPayoutRecord[] {
  const ids = listOrdersBySeller(sellerId).map((o) => o.id);
  return PAYOUTS.filter((p) => ids.includes(p.order_id));
}

export function getPlatformAnalytics() { return ANALYTICS; }

export function listAllSellers(flagged = false): (MockSeller & { metrics: MockSellerMetrics })[] {
  const enriched = SELLERS.map((s) => ({ ...s, metrics: SELLER_METRICS[s.id] ?? SELLER_METRICS["seller-001"] }));
  if (flagged) return enriched.filter((s) => s.metrics.dispute_rate > 0.05 || s.status === "suspended");
  return enriched;
}

export function getWebhookLogs() { return WEBHOOK_EVENTS; }
export function getGasReport(): GasReport { return GAS_REPORT; }
export function getDisputeForOrder(orderId: string) { return DISPUTES.find((d) => d.order_id === orderId) ?? null; }
