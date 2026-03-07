// ─── Types (inline, independent of demo-store) ────────────────────────────

export enum OrderState {
  INITIATED = "INITIATED",
  ESCROWED = "ESCROWED",
  LABEL_CREATED = "LABEL_CREATED",
  SHIPPED = "SHIPPED",
  IN_TRANSIT = "IN_TRANSIT",
  DELIVERED = "DELIVERED",
  FINALIZED = "FINALIZED",
  DISPUTED = "DISPUTED",
}

export enum DisputeStatus {
  OPEN = "OPEN",
  SELLER_RESPONDED = "SELLER_RESPONDED",
  RESOLVED = "RESOLVED",
  AUTO_RESOLVED = "AUTO_RESOLVED",
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price_usd: number;
  weight_oz: number;
  dimensions: { length: number; width: number; height: number };
  seller_id: string;
  seller_name: string;
  category: string;
  stock: number;
}

export interface ShippingOption {
  id: string;
  carrier: string;
  service: string;
  price_usd: number;
  estimated_days: number;
}

export interface ShippingAddress {
  name: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface EscrowDetails {
  escrowId: string;
  contractAddress: string;
  totalAmount: string;
  remainingAmount: string;
  txHash: string;
  blockNumber: number;
  createdAt: string;
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price_usd: number;
}

export interface PayoutSchedule {
  state: OrderState;
  percentageBps: number;
  label: string;
  releasedAt?: string;
  txHash?: string;
  amountToken?: string;
}

export interface StateTransition {
  from: OrderState;
  to: OrderState;
  timestamp: string;
  txHash?: string;
  triggeredBy: "buyer" | "seller" | "system" | "oracle";
}

export interface Order {
  id: string;
  buyer_wallet: string;
  seller_id: string;
  seller_name: string;
  items: OrderItem[];
  state: OrderState;
  total_usd: number;
  total_token: string;
  shipping_option?: ShippingOption;
  shipping_address?: ShippingAddress;
  escrow?: EscrowDetails;
  payout_schedule: PayoutSchedule[];
  tracking_number?: string;
  carrier?: string;
  label_url?: string;
  invoice_ipfs_url?: string;
  created_at: string;
  updated_at: string;
  state_history: StateTransition[];
}

export interface Seller {
  id: string;
  business_name: string;
  wallet_address: string;
  email: string;
  status: "pending" | "active" | "suspended";
  created_at: string;
}

export interface SellerMetrics {
  seller_id: string;
  total_orders: number;
  total_revenue_usd: number;
  fulfillment_avg_hours: number;
  dispute_rate: number;
  active_escrows: number;
  pending_payouts_usd: number;
}

export interface PayoutRecord {
  id: string;
  seller_id: string;
  order_id: string;
  state: OrderState;
  amount_usd: number;
  tx_hash: string;
  timestamp: string;
}

export interface Dispute {
  id: string;
  order_id: string;
  buyer_wallet: string;
  seller_id: string;
  status: DisputeStatus;
  reason: string;
  buyer_description: string;
  seller_response?: string;
  frozen_amount_usd: number;
  deadline: string;
  created_at: string;
  resolved_at?: string;
  resolution?: "refund_buyer" | "release_seller" | "partial";
}

export interface PlatformAnalytics {
  total_orders: number;
  total_volume_usd: number;
  active_escrows: number;
  dispute_rate: number;
  avg_resolution_hours: number;
  orders_by_day: { date: string; count: number; volume_usd: number }[];
}

export interface WebhookEvent {
  id: string;
  event_type: string;
  source: "shippo" | "contract" | "manual";
  order_id?: string;
  payload: Record<string, unknown>;
  status: "received" | "processed" | "failed";
  http_status?: number;
  timestamp: string;
}

export interface GasReport {
  total_gas_usd: number;
  total_transactions: number;
  avg_gas_per_transition_usd: number;
  by_transition: { transition: string; count: number; avg_gas_usd: number }[];
}

// ─── Mock Products ─────────────────────────────────────────────────────────

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "prod-001",
    name: "Mechanical Keyboard – TKL Pro",
    description: "Tenkeyless mechanical keyboard with Cherry MX Red switches. Hot-swap PCB, RGB per-key lighting, aluminum case.",
    price_usd: 149.99,
    weight_oz: 22,
    dimensions: { length: 14, width: 5, height: 1.5 },
    seller_id: "seller-001",
    seller_name: "TechGear Co.",
    category: "Electronics",
    stock: 12,
  },
  {
    id: "prod-002",
    name: "Noise Cancelling Headphones",
    description: "Over-ear wireless headphones with 40-hour battery life, ANC, and studio-grade audio.",
    price_usd: 249.0,
    weight_oz: 11,
    dimensions: { length: 8, width: 7, height: 3.5 },
    seller_id: "seller-001",
    seller_name: "TechGear Co.",
    category: "Electronics",
    stock: 8,
  },
  {
    id: "prod-003",
    name: "Ergonomic Office Chair",
    description: "Lumbar support, breathable mesh back, adjustable armrests and seat height. Built for 8-hour workdays.",
    price_usd: 399.0,
    weight_oz: 480,
    dimensions: { length: 28, width: 28, height: 48 },
    seller_id: "seller-002",
    seller_name: "HomeWork Studio",
    category: "Furniture",
    stock: 5,
  },
  {
    id: "prod-004",
    name: "4K Webcam – StreamPro",
    description: "Ultra-sharp 4K webcam with built-in ring light and auto-focus. Wide 90° FOV.",
    price_usd: 89.99,
    weight_oz: 6,
    dimensions: { length: 4, width: 2, height: 2 },
    seller_id: "seller-001",
    seller_name: "TechGear Co.",
    category: "Electronics",
    stock: 20,
  },
  {
    id: "prod-005",
    name: "Leather Laptop Bag",
    description: "Full-grain leather laptop bag fits up to 16\". Padded laptop sleeve, organizer pockets.",
    price_usd: 179.0,
    weight_oz: 28,
    dimensions: { length: 17, width: 12, height: 4 },
    seller_id: "seller-002",
    seller_name: "HomeWork Studio",
    category: "Accessories",
    stock: 15,
  },
];

// ─── Mock Sellers ──────────────────────────────────────────────────────────

export const MOCK_SELLERS: Seller[] = [
  {
    id: "seller-001",
    business_name: "TechGear Co.",
    wallet_address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    email: "seller@techgear.co",
    status: "active",
    created_at: "2025-01-15T10:00:00Z",
  },
  {
    id: "seller-002",
    business_name: "HomeWork Studio",
    wallet_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    email: "seller@homeworkstudio.com",
    status: "active",
    created_at: "2025-02-01T09:00:00Z",
  },
  {
    id: "seller-003",
    business_name: "Budget Gadgets LLC",
    wallet_address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    email: "contact@budgetgadgets.io",
    status: "active",
    created_at: "2025-03-10T08:00:00Z",
  },
];

// ─── Mock Seller Metrics ───────────────────────────────────────────────────

export const MOCK_SELLER_METRICS: Record<string, SellerMetrics> = {
  "seller-001": {
    seller_id: "seller-001",
    total_orders: 47,
    total_revenue_usd: 12840.5,
    fulfillment_avg_hours: 18.4,
    dispute_rate: 0.02,
    active_escrows: 3,
    pending_payouts_usd: 1284.05,
  },
  "seller-002": {
    seller_id: "seller-002",
    total_orders: 31,
    total_revenue_usd: 8920.0,
    fulfillment_avg_hours: 24.1,
    dispute_rate: 0.065,
    active_escrows: 2,
    pending_payouts_usd: 892.0,
  },
  "seller-003": {
    seller_id: "seller-003",
    total_orders: 12,
    total_revenue_usd: 1340.0,
    fulfillment_avg_hours: 72.0,
    dispute_rate: 0.25,
    active_escrows: 1,
    pending_payouts_usd: 134.0,
  },
};

// ─── Mock Orders ───────────────────────────────────────────────────────────

export const MOCK_ORDERS: Order[] = [
  // order-001: SHIPPED — buyer 0xf39F, seller-001
  {
    id: "order-001",
    buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-001",
    seller_name: "TechGear Co.",
    items: [
      { product_id: "prod-001", product_name: "Mechanical Keyboard – TKL Pro", quantity: 1, price_usd: 149.99 },
    ],
    state: OrderState.SHIPPED,
    total_usd: 159.98,
    total_token: "159980000000000000000",
    shipping_option: { id: "ship-usps-priority", carrier: "USPS", service: "Priority Mail", price_usd: 9.99, estimated_days: 3 },
    shipping_address: { name: "Alex Buyer", address1: "100 Main St", city: "Austin", state: "TX", zip: "78701", country: "US" },
    escrow: {
      escrowId: "escrow-001",
      contractAddress: "0x0000000000000000000000000000000000000001",
      totalAmount: "159980000000000000000",
      remainingAmount: "111986000000000000000",
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      blockNumber: 12345678,
      createdAt: "2025-12-09T12:00:00Z",
    },
    payout_schedule: [
      { state: OrderState.LABEL_CREATED, percentageBps: 1500, label: "Label Printed (15%)", releasedAt: "2025-12-10T14:00:00Z", txHash: "0xabc123", amountToken: "23997000000000000000" },
      { state: OrderState.SHIPPED, percentageBps: 1500, label: "Shipped (15%)", releasedAt: "2025-12-11T10:00:00Z", txHash: "0xdef456", amountToken: "23997000000000000000" },
      { state: OrderState.IN_TRANSIT, percentageBps: 2000, label: "In Transit (20%)" },
      { state: OrderState.DELIVERED, percentageBps: 3500, label: "Delivered (35%)" },
      { state: OrderState.FINALIZED, percentageBps: 1500, label: "Finalized (15%)" },
    ],
    tracking_number: "9400111899221234567890",
    carrier: "USPS",
    label_url: "https://example.com/label-001.pdf",
    invoice_ipfs_url: "ipfs://QmXyz123abc456/invoice-order-001.pdf",
    created_at: "2025-12-09T12:00:00Z",
    updated_at: "2025-12-11T10:30:00Z",
    state_history: [
      { from: OrderState.INITIATED, to: OrderState.ESCROWED, timestamp: "2025-12-09T12:01:00Z", txHash: "0x1234567890abcdef", triggeredBy: "buyer" },
      { from: OrderState.ESCROWED, to: OrderState.LABEL_CREATED, timestamp: "2025-12-10T14:00:00Z", txHash: "0xabc123", triggeredBy: "seller" },
      { from: OrderState.LABEL_CREATED, to: OrderState.SHIPPED, timestamp: "2025-12-11T10:00:00Z", txHash: "0xdef456", triggeredBy: "system" },
    ],
  },
  // order-002: DELIVERED — buyer 0xf39F, seller-002
  {
    id: "order-002",
    buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-002",
    seller_name: "HomeWork Studio",
    items: [
      { product_id: "prod-005", product_name: "Leather Laptop Bag", quantity: 1, price_usd: 179.0 },
    ],
    state: OrderState.DELIVERED,
    total_usd: 187.49,
    total_token: "187490000000000000000",
    shipping_option: { id: "ship-ups-ground", carrier: "UPS", service: "Ground", price_usd: 8.49, estimated_days: 4 },
    shipping_address: { name: "Alex Buyer", address1: "100 Main St", city: "Austin", state: "TX", zip: "78701", country: "US" },
    escrow: {
      escrowId: "escrow-002",
      contractAddress: "0x0000000000000000000000000000000000000001",
      totalAmount: "187490000000000000000",
      remainingAmount: "28123500000000000000",
      txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      blockNumber: 12345900,
      createdAt: "2025-12-01T09:00:00Z",
    },
    payout_schedule: [
      { state: OrderState.LABEL_CREATED, percentageBps: 1500, label: "Label Printed (15%)", releasedAt: "2025-12-02T11:00:00Z", txHash: "0xaaa111", amountToken: "28123500000000000000" },
      { state: OrderState.SHIPPED, percentageBps: 1500, label: "Shipped (15%)", releasedAt: "2025-12-03T09:00:00Z", txHash: "0xbbb222", amountToken: "28123500000000000000" },
      { state: OrderState.IN_TRANSIT, percentageBps: 2000, label: "In Transit (20%)", releasedAt: "2025-12-04T14:00:00Z", txHash: "0xccc333", amountToken: "37498000000000000000" },
      { state: OrderState.DELIVERED, percentageBps: 3500, label: "Delivered (35%)", releasedAt: "2025-12-06T10:00:00Z", txHash: "0xddd444", amountToken: "65621500000000000000" },
      { state: OrderState.FINALIZED, percentageBps: 1500, label: "Finalized (15%)" },
    ],
    tracking_number: "1Z999AA10123456784",
    carrier: "UPS",
    invoice_ipfs_url: "ipfs://QmXyz123abc456/invoice-order-002.pdf",
    created_at: "2025-12-01T09:00:00Z",
    updated_at: "2025-12-06T10:30:00Z",
    state_history: [
      { from: OrderState.INITIATED, to: OrderState.ESCROWED, timestamp: "2025-12-01T09:01:00Z", triggeredBy: "buyer" },
      { from: OrderState.ESCROWED, to: OrderState.LABEL_CREATED, timestamp: "2025-12-02T11:00:00Z", triggeredBy: "seller" },
      { from: OrderState.LABEL_CREATED, to: OrderState.SHIPPED, timestamp: "2025-12-03T09:00:00Z", triggeredBy: "system" },
      { from: OrderState.SHIPPED, to: OrderState.IN_TRANSIT, timestamp: "2025-12-04T14:00:00Z", triggeredBy: "oracle" },
      { from: OrderState.IN_TRANSIT, to: OrderState.DELIVERED, timestamp: "2025-12-06T10:00:00Z", triggeredBy: "oracle" },
    ],
  },
  // order-003: DISPUTED — buyer 0xf39F, seller-001
  {
    id: "order-003",
    buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-001",
    seller_name: "TechGear Co.",
    items: [
      { product_id: "prod-002", product_name: "Noise Cancelling Headphones", quantity: 1, price_usd: 249.0 },
    ],
    state: OrderState.DISPUTED,
    total_usd: 258.99,
    total_token: "258990000000000000000",
    shipping_option: { id: "ship-fedex-express", carrier: "FedEx", service: "Express Saver", price_usd: 9.99, estimated_days: 2 },
    shipping_address: { name: "Alex Buyer", address1: "100 Main St", city: "Austin", state: "TX", zip: "78701", country: "US" },
    escrow: {
      escrowId: "escrow-003",
      contractAddress: "0x0000000000000000000000000000000000000001",
      totalAmount: "258990000000000000000",
      remainingAmount: "181293000000000000000",
      txHash: "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
      blockNumber: 12346100,
      createdAt: "2025-12-12T08:00:00Z",
    },
    payout_schedule: [
      { state: OrderState.LABEL_CREATED, percentageBps: 1500, label: "Label Printed (15%)", releasedAt: "2025-12-13T09:00:00Z", txHash: "0xeee555", amountToken: "38848500000000000000" },
      { state: OrderState.SHIPPED, percentageBps: 1500, label: "Shipped (15%)", releasedAt: "2025-12-13T18:00:00Z", txHash: "0xfff666", amountToken: "38848500000000000000" },
      { state: OrderState.IN_TRANSIT, percentageBps: 2000, label: "In Transit (20%)" },
      { state: OrderState.DELIVERED, percentageBps: 3500, label: "Delivered (35%)" },
      { state: OrderState.FINALIZED, percentageBps: 1500, label: "Finalized (15%)" },
    ],
    tracking_number: "274899689282",
    carrier: "FedEx",
    invoice_ipfs_url: "ipfs://QmXyz123abc456/invoice-order-003.pdf",
    created_at: "2025-12-12T08:00:00Z",
    updated_at: "2025-12-14T09:05:00Z",
    state_history: [
      { from: OrderState.INITIATED, to: OrderState.ESCROWED, timestamp: "2025-12-12T08:01:00Z", triggeredBy: "buyer" },
      { from: OrderState.ESCROWED, to: OrderState.LABEL_CREATED, timestamp: "2025-12-13T09:00:00Z", triggeredBy: "seller" },
      { from: OrderState.LABEL_CREATED, to: OrderState.SHIPPED, timestamp: "2025-12-13T18:00:00Z", triggeredBy: "system" },
      { from: OrderState.SHIPPED, to: OrderState.DISPUTED, timestamp: "2025-12-14T09:05:00Z", triggeredBy: "buyer" },
    ],
  },
  // order-004: ESCROWED — buyer 0xBeta, seller-001 (needs seller action)
  {
    id: "order-004",
    buyer_wallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C9",
    seller_id: "seller-001",
    seller_name: "TechGear Co.",
    items: [
      { product_id: "prod-004", product_name: "4K Webcam – StreamPro", quantity: 2, price_usd: 89.99 },
    ],
    state: OrderState.ESCROWED,
    total_usd: 189.97,
    total_token: "189970000000000000000",
    shipping_option: { id: "ship-usps-ground", carrier: "USPS", service: "Ground Advantage", price_usd: 9.99, estimated_days: 5 },
    shipping_address: { name: "Beta User", address1: "200 Oak Ave", city: "Denver", state: "CO", zip: "80201", country: "US" },
    escrow: {
      escrowId: "escrow-004",
      contractAddress: "0x0000000000000000000000000000000000000001",
      totalAmount: "189970000000000000000",
      remainingAmount: "189970000000000000000",
      txHash: "0xcafebabe1234567890abcdef1234567890abcdef1234567890abcdef12345678",
      blockNumber: 12346500,
      createdAt: "2025-12-15T10:00:00Z",
    },
    payout_schedule: [
      { state: OrderState.LABEL_CREATED, percentageBps: 1500, label: "Label Printed (15%)" },
      { state: OrderState.SHIPPED, percentageBps: 1500, label: "Shipped (15%)" },
      { state: OrderState.IN_TRANSIT, percentageBps: 2000, label: "In Transit (20%)" },
      { state: OrderState.DELIVERED, percentageBps: 3500, label: "Delivered (35%)" },
      { state: OrderState.FINALIZED, percentageBps: 1500, label: "Finalized (15%)" },
    ],
    created_at: "2025-12-15T10:00:00Z",
    updated_at: "2025-12-15T10:01:00Z",
    state_history: [
      { from: OrderState.INITIATED, to: OrderState.ESCROWED, timestamp: "2025-12-15T10:01:00Z", triggeredBy: "buyer" },
    ],
  },
  // order-005: FINALIZED — buyer 0xf39F, seller-002
  {
    id: "order-005",
    buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-002",
    seller_name: "HomeWork Studio",
    items: [
      { product_id: "prod-003", product_name: "Ergonomic Office Chair", quantity: 1, price_usd: 399.0 },
    ],
    state: OrderState.FINALIZED,
    total_usd: 419.0,
    total_token: "419000000000000000000",
    shipping_option: { id: "ship-ups-3day", carrier: "UPS", service: "3-Day Select", price_usd: 20.0, estimated_days: 3 },
    shipping_address: { name: "Alex Buyer", address1: "100 Main St", city: "Austin", state: "TX", zip: "78701", country: "US" },
    escrow: {
      escrowId: "escrow-005",
      contractAddress: "0x0000000000000000000000000000000000000001",
      totalAmount: "419000000000000000000",
      remainingAmount: "0",
      txHash: "0x0101010101010101010101010101010101010101010101010101010101010101",
      blockNumber: 12344000,
      createdAt: "2025-11-20T08:00:00Z",
    },
    payout_schedule: [
      { state: OrderState.LABEL_CREATED, percentageBps: 1500, label: "Label Printed (15%)", releasedAt: "2025-11-21T10:00:00Z", txHash: "0x111aaa", amountToken: "62850000000000000000" },
      { state: OrderState.SHIPPED, percentageBps: 1500, label: "Shipped (15%)", releasedAt: "2025-11-22T09:00:00Z", txHash: "0x222bbb", amountToken: "62850000000000000000" },
      { state: OrderState.IN_TRANSIT, percentageBps: 2000, label: "In Transit (20%)", releasedAt: "2025-11-23T14:00:00Z", txHash: "0x333ccc", amountToken: "83800000000000000000" },
      { state: OrderState.DELIVERED, percentageBps: 3500, label: "Delivered (35%)", releasedAt: "2025-11-25T10:00:00Z", txHash: "0x444ddd", amountToken: "146650000000000000000" },
      { state: OrderState.FINALIZED, percentageBps: 1500, label: "Finalized (15%)", releasedAt: "2025-11-28T10:00:00Z", txHash: "0x555eee", amountToken: "62850000000000000000" },
    ],
    tracking_number: "1Z999AA10123456799",
    carrier: "UPS",
    invoice_ipfs_url: "ipfs://QmXyz123abc456/invoice-order-005.pdf",
    created_at: "2025-11-20T08:00:00Z",
    updated_at: "2025-11-28T10:00:00Z",
    state_history: [
      { from: OrderState.INITIATED, to: OrderState.ESCROWED, timestamp: "2025-11-20T08:01:00Z", triggeredBy: "buyer" },
      { from: OrderState.ESCROWED, to: OrderState.LABEL_CREATED, timestamp: "2025-11-21T10:00:00Z", triggeredBy: "seller" },
      { from: OrderState.LABEL_CREATED, to: OrderState.SHIPPED, timestamp: "2025-11-22T09:00:00Z", triggeredBy: "system" },
      { from: OrderState.SHIPPED, to: OrderState.IN_TRANSIT, timestamp: "2025-11-23T14:00:00Z", triggeredBy: "oracle" },
      { from: OrderState.IN_TRANSIT, to: OrderState.DELIVERED, timestamp: "2025-11-25T10:00:00Z", triggeredBy: "oracle" },
      { from: OrderState.DELIVERED, to: OrderState.FINALIZED, timestamp: "2025-11-28T10:00:00Z", triggeredBy: "buyer" },
    ],
  },
];

// ─── Mock Disputes ─────────────────────────────────────────────────────────

export const MOCK_DISPUTES: Dispute[] = [
  {
    id: "dispute-001",
    order_id: "order-003",
    buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-001",
    status: DisputeStatus.OPEN,
    reason: "item_damaged",
    buyer_description: "Item arrived with cracked casing — one earcup completely broken. Packaging was intact so damage occurred before shipping.",
    frozen_amount_usd: 181.29,
    deadline: "2025-12-21T09:05:00Z",
    created_at: "2025-12-14T09:05:00Z",
  },
  {
    id: "dispute-002",
    order_id: "order-005",
    buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-002",
    status: DisputeStatus.RESOLVED,
    reason: "wrong_item",
    buyer_description: "Received a different chair model than listed.",
    seller_response: "We shipped the correct item per the SKU. The listing photos match exactly. Happy to provide shipping photos.",
    frozen_amount_usd: 0,
    deadline: "2025-12-05T08:00:00Z",
    created_at: "2025-11-28T12:00:00Z",
    resolved_at: "2025-11-30T15:00:00Z",
    resolution: "release_seller",
  },
];

// ─── Mock Payout Records ───────────────────────────────────────────────────

export const MOCK_PAYOUT_RECORDS: PayoutRecord[] = [
  { id: "payout-001", seller_id: "seller-001", order_id: "order-001", state: OrderState.LABEL_CREATED, amount_usd: 23.997, tx_hash: "0xabc123", timestamp: "2025-12-10T14:00:00Z" },
  { id: "payout-002", seller_id: "seller-001", order_id: "order-001", state: OrderState.SHIPPED, amount_usd: 23.997, tx_hash: "0xdef456", timestamp: "2025-12-11T10:00:00Z" },
  { id: "payout-003", seller_id: "seller-002", order_id: "order-002", state: OrderState.LABEL_CREATED, amount_usd: 28.12, tx_hash: "0xaaa111", timestamp: "2025-12-02T11:00:00Z" },
  { id: "payout-004", seller_id: "seller-002", order_id: "order-002", state: OrderState.SHIPPED, amount_usd: 28.12, tx_hash: "0xbbb222", timestamp: "2025-12-03T09:00:00Z" },
  { id: "payout-005", seller_id: "seller-002", order_id: "order-002", state: OrderState.IN_TRANSIT, amount_usd: 37.49, tx_hash: "0xccc333", timestamp: "2025-12-04T14:00:00Z" },
  { id: "payout-006", seller_id: "seller-002", order_id: "order-002", state: OrderState.DELIVERED, amount_usd: 65.62, tx_hash: "0xddd444", timestamp: "2025-12-06T10:00:00Z" },
  { id: "payout-007", seller_id: "seller-001", order_id: "order-003", state: OrderState.LABEL_CREATED, amount_usd: 38.84, tx_hash: "0xeee555", timestamp: "2025-12-13T09:00:00Z" },
  { id: "payout-008", seller_id: "seller-001", order_id: "order-003", state: OrderState.SHIPPED, amount_usd: 38.84, tx_hash: "0xfff666", timestamp: "2025-12-13T18:00:00Z" },
  { id: "payout-009", seller_id: "seller-002", order_id: "order-005", state: OrderState.LABEL_CREATED, amount_usd: 62.85, tx_hash: "0x111aaa", timestamp: "2025-11-21T10:00:00Z" },
  { id: "payout-010", seller_id: "seller-002", order_id: "order-005", state: OrderState.SHIPPED, amount_usd: 62.85, tx_hash: "0x222bbb", timestamp: "2025-11-22T09:00:00Z" },
  { id: "payout-011", seller_id: "seller-002", order_id: "order-005", state: OrderState.IN_TRANSIT, amount_usd: 83.80, tx_hash: "0x333ccc", timestamp: "2025-11-23T14:00:00Z" },
  { id: "payout-012", seller_id: "seller-002", order_id: "order-005", state: OrderState.DELIVERED, amount_usd: 146.65, tx_hash: "0x444ddd", timestamp: "2025-11-25T10:00:00Z" },
  { id: "payout-013", seller_id: "seller-002", order_id: "order-005", state: OrderState.FINALIZED, amount_usd: 62.85, tx_hash: "0x555eee", timestamp: "2025-11-28T10:00:00Z" },
];

// ─── Mock Platform Analytics ───────────────────────────────────────────────

export const MOCK_ANALYTICS: PlatformAnalytics = {
  total_orders: 234,
  total_volume_usd: 48920.0,
  active_escrows: 12,
  dispute_rate: 0.017,
  avg_resolution_hours: 14.2,
  orders_by_day: [
    { date: "2025-11-30", count: 8, volume_usd: 1842.5 },
    { date: "2025-12-01", count: 12, volume_usd: 2910.0 },
    { date: "2025-12-02", count: 9, volume_usd: 1976.3 },
    { date: "2025-12-03", count: 15, volume_usd: 3210.5 },
    { date: "2025-12-04", count: 11, volume_usd: 2340.0 },
    { date: "2025-12-05", count: 7, volume_usd: 1540.2 },
    { date: "2025-12-06", count: 14, volume_usd: 2980.8 },
  ],
};

// ─── Mock Webhook Events ───────────────────────────────────────────────────

export const MOCK_WEBHOOK_EVENTS: WebhookEvent[] = [
  { id: "wh-001", event_type: "order.state_advanced", source: "contract", order_id: "order-001", payload: { orderId: "order-001", fromState: "ESCROWED", toState: "LABEL_CREATED" }, status: "processed", http_status: 200, timestamp: "2025-12-10T14:00:05Z" },
  { id: "wh-002", event_type: "tracking.shipped", source: "shippo", order_id: "order-001", payload: { tracking_number: "9400111899221234567890", status: "TRANSIT" }, status: "processed", http_status: 200, timestamp: "2025-12-11T10:00:12Z" },
  { id: "wh-003", event_type: "tracking.delivered", source: "shippo", order_id: "order-002", payload: { tracking_number: "1Z999AA10123456784", status: "DELIVERED" }, status: "processed", http_status: 200, timestamp: "2025-12-06T10:00:08Z" },
  { id: "wh-004", event_type: "order.state_advanced", source: "contract", order_id: "order-002", payload: { orderId: "order-002", fromState: "IN_TRANSIT", toState: "DELIVERED" }, status: "processed", http_status: 200, timestamp: "2025-12-06T10:00:30Z" },
  { id: "wh-005", event_type: "dispute.created", source: "contract", order_id: "order-003", payload: { disputeId: "dispute-001", frozenAmount: "181290000000000000000" }, status: "processed", http_status: 200, timestamp: "2025-12-14T09:05:10Z" },
  { id: "wh-006", event_type: "webhook.retry", source: "manual", order_id: "order-004", payload: { reason: "timeout", attempt: 2 }, status: "failed", http_status: 503, timestamp: "2025-12-15T10:30:00Z" },
  { id: "wh-007", event_type: "order.state_advanced", source: "contract", order_id: "order-005", payload: { orderId: "order-005", fromState: "DELIVERED", toState: "FINALIZED" }, status: "processed", http_status: 200, timestamp: "2025-11-28T10:00:05Z" },
];

// ─── Mock Gas Report ───────────────────────────────────────────────────────

export const MOCK_GAS_REPORT: GasReport = {
  total_gas_usd: 48.32,
  total_transactions: 96,
  avg_gas_per_transition_usd: 0.503,
  by_transition: [
    { transition: "INITIATED → ESCROWED", count: 24, avg_gas_usd: 0.72 },
    { transition: "ESCROWED → LABEL_CREATED", count: 22, avg_gas_usd: 0.54 },
    { transition: "LABEL_CREATED → SHIPPED", count: 21, avg_gas_usd: 0.41 },
    { transition: "SHIPPED → IN_TRANSIT", count: 19, avg_gas_usd: 0.38 },
    { transition: "IN_TRANSIT → DELIVERED", count: 18, avg_gas_usd: 0.36 },
    { transition: "DELIVERED → FINALIZED", count: 15, avg_gas_usd: 0.33 },
    { transition: "* → DISPUTED", count: 4, avg_gas_usd: 0.61 },
  ],
};
