import {
  type Product,
  type Order,
  type Seller,
  type SellerMetrics,
  type PayoutRecord,
  type PlatformAnalytics,
  type WebhookEvent,
  type ShippingOption,
  OrderState,
} from "./flowstate/types";

// ─── Mock Products ────────────────────────────────────────────────────────

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "prod-001",
    name: "Mechanical Keyboard – TKL Pro",
    description:
      "Tenkeyless mechanical keyboard with Cherry MX Red switches. Hot-swap PCB, RGB per-key lighting, aluminum case. Perfect for developers and writers who want the tactile feel without the number pad.",
    price_usd: 149.99,
    weight_oz: 22,
    dimensions: { length: 14, width: 5, height: 1.5 },
    seller_id: "seller-001",
    seller_name: "TechGear Co.",
    image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80",
    category: "Electronics",
    stock: 12,
  },
  {
    id: "prod-002",
    name: "Noise Cancelling Headphones",
    description:
      "Over-ear wireless headphones with 40-hour battery life, ANC, and studio-grade audio. Comfortable memory foam ear cups. Compatible with all Bluetooth devices.",
    price_usd: 249.0,
    weight_oz: 11,
    dimensions: { length: 8, width: 7, height: 3.5 },
    seller_id: "seller-001",
    seller_name: "TechGear Co.",
    image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
    category: "Electronics",
    stock: 8,
  },
  {
    id: "prod-003",
    name: "Ergonomic Office Chair",
    description:
      "Lumbar support, breathable mesh back, adjustable armrests and seat height. Built for 8-hour workdays. Ships flat-packed with easy assembly.",
    price_usd: 399.0,
    weight_oz: 480,
    dimensions: { length: 28, width: 28, height: 48 },
    seller_id: "seller-002",
    seller_name: "HomeWork Studio",
    image_url: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=800&q=80",
    category: "Furniture",
    stock: 5,
  },
  {
    id: "prod-004",
    name: "4K Webcam – StreamPro",
    description:
      "Ultra-sharp 4K webcam with built-in ring light and auto-focus. Perfect for streaming, video calls, and content creation. Wide 90° FOV.",
    price_usd: 89.99,
    weight_oz: 6,
    dimensions: { length: 4, width: 2, height: 2 },
    seller_id: "seller-001",
    seller_name: "TechGear Co.",
    image_url: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80",
    category: "Electronics",
    stock: 20,
  },
  {
    id: "prod-005",
    name: "Leather Laptop Bag",
    description:
      "Full-grain leather laptop bag fits up to 16\". Padded laptop sleeve, organizer pockets, adjustable shoulder strap. Ages beautifully.",
    price_usd: 179.0,
    weight_oz: 28,
    dimensions: { length: 17, width: 12, height: 4 },
    seller_id: "seller-002",
    seller_name: "HomeWork Studio",
    image_url: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80",
    category: "Accessories",
    stock: 15,
  },
  {
    id: "prod-006",
    name: "Standing Desk Converter",
    description:
      "Sit-stand desktop riser fits any existing desk. Dual monitor support, keyboard tray, smooth gas spring lift. No assembly required.",
    price_usd: 229.0,
    weight_oz: 276,
    dimensions: { length: 36, width: 24, height: 20 },
    seller_id: "seller-002",
    seller_name: "HomeWork Studio",
    image_url: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&q=80",
    category: "Furniture",
    stock: 7,
  },
  {
    id: "prod-007",
    name: "Wireless Charging Pad",
    description:
      "15W fast wireless charging pad compatible with iPhone 15, Samsung Galaxy S24, and all Qi devices. LED indicator, non-slip base.",
    price_usd: 34.99,
    weight_oz: 3,
    dimensions: { length: 4, width: 4, height: 0.3 },
    seller_id: "seller-001",
    seller_name: "TechGear Co.",
    image_url: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&q=80",
    category: "Electronics",
    stock: 35,
  },
  {
    id: "prod-008",
    name: "Smart LED Desk Lamp",
    description:
      "Adjustable color temperature 2700K–6500K, brightness control, USB-C charging port on base, touch controls, eye-care mode.",
    price_usd: 59.99,
    weight_oz: 24,
    dimensions: { length: 18, width: 6, height: 20 },
    seller_id: "seller-002",
    seller_name: "HomeWork Studio",
    image_url: "https://images.unsplash.com/photo-1534073828943-f801091bb18c?w=800&q=80",
    category: "Accessories",
    stock: 18,
  },
  {
    id: "prod-009",
    name: "USB-C Hub – 10-in-1",
    description:
      "Expand connectivity with 4K HDMI, 100W PD, SD/microSD, 3× USB-A, USB-C data, Ethernet. Compact aluminum housing.",
    price_usd: 64.99,
    weight_oz: 4,
    dimensions: { length: 5, width: 2, height: 0.5 },
    seller_id: "seller-001",
    seller_name: "TechGear Co.",
    image_url: "https://images.unsplash.com/photo-1625480860249-be231806b2a7?w=800&q=80",
    category: "Electronics",
    stock: 22,
  },
  {
    id: "prod-010",
    name: "Artisan Coffee Mug Set",
    description:
      "Set of 4 hand-thrown ceramic mugs, 12oz each. Food-safe glaze, microwave and dishwasher safe. Each piece is unique.",
    price_usd: 79.0,
    weight_oz: 48,
    dimensions: { length: 12, width: 6, height: 5 },
    seller_id: "seller-002",
    seller_name: "HomeWork Studio",
    image_url: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&q=80",
    category: "Accessories",
    stock: 10,
  },
];

// ─── Mock Sellers ─────────────────────────────────────────────────────────

export const MOCK_SELLERS: Seller[] = [
  {
    id: "seller-001",
    business_name: "TechGear Co.",
    wallet_address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    email: "seller@techgear.co",
    address: {
      name: "TechGear Co.",
      address1: "1234 Tech Blvd",
      city: "San Francisco",
      state: "CA",
      zip: "94102",
      country: "US",
    },
    payout_config: {
      immediate_bps: 3000,
      milestone_bps: 5500,
      holdback_bps: 1500,
    },
    status: "active",
    created_at: "2025-01-15T10:00:00Z",
  },
  {
    id: "seller-002",
    business_name: "HomeWork Studio",
    wallet_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    email: "seller@homeworkstudio.com",
    address: {
      name: "HomeWork Studio",
      address1: "5678 Design Ave",
      city: "Brooklyn",
      state: "NY",
      zip: "11201",
      country: "US",
    },
    payout_config: {
      immediate_bps: 3000,
      milestone_bps: 5500,
      holdback_bps: 1500,
    },
    status: "active",
    created_at: "2025-02-01T09:00:00Z",
  },
];

export const MOCK_SELLER_METRICS: SellerMetrics = {
  total_orders: 47,
  total_revenue_usd: 12840.5,
  total_revenue_token: "12840500000000000000000",
  fulfillment_avg_hours: 18.4,
  dispute_rate: 0.02,
  active_escrows: 5,
  pending_payouts_token: "1284050000000000000000",
};

// ─── Mock Shipping Options ────────────────────────────────────────────────

export const MOCK_SHIPPING_OPTIONS: ShippingOption[] = [
  {
    id: "ship-usps-ground",
    carrier: "USPS",
    service: "Ground Advantage",
    price_usd: 5.99,
    estimated_days: 5,
  },
  {
    id: "ship-usps-priority",
    carrier: "USPS",
    service: "Priority Mail",
    price_usd: 9.99,
    estimated_days: 3,
  },
  {
    id: "ship-ups-ground",
    carrier: "UPS",
    service: "Ground",
    price_usd: 8.49,
    estimated_days: 4,
  },
  {
    id: "ship-ups-3day",
    carrier: "UPS",
    service: "3-Day Select",
    price_usd: 18.99,
    estimated_days: 3,
  },
  {
    id: "ship-fedex-express",
    carrier: "FedEx",
    service: "Express Saver",
    price_usd: 24.99,
    estimated_days: 2,
  },
];

// ─── Mock Orders ──────────────────────────────────────────────────────────

const makePayoutSchedule = (total: number) => [
  {
    state: OrderState.LABEL_CREATED,
    percentageBps: 1500,
    label: "Label Printed (15%)",
    releasedAt: "2025-12-10T14:00:00Z",
    txHash: "0xabc123",
    amountToken: String(Math.floor(total * 0.15)),
  },
  {
    state: OrderState.SHIPPED,
    percentageBps: 1500,
    label: "Shipped (15%)",
    releasedAt: "2025-12-11T10:00:00Z",
    txHash: "0xdef456",
    amountToken: String(Math.floor(total * 0.15)),
  },
  {
    state: OrderState.IN_TRANSIT,
    percentageBps: 2000,
    label: "In Transit (20%)",
  },
  {
    state: OrderState.DELIVERED,
    percentageBps: 3500,
    label: "Delivered (35%)",
  },
  {
    state: OrderState.FINALIZED,
    percentageBps: 1500,
    label: "Finalized (15%)",
  },
];

export const MOCK_ORDERS: Order[] = [
  {
    id: "order-001",
    buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-001",
    seller_name: "TechGear Co.",
    items: [
      {
        product_id: "prod-001",
        product_name: "Mechanical Keyboard – TKL Pro",
        quantity: 1,
        price_usd: 149.99,
        image_url: MOCK_PRODUCTS[0].image_url,
      },
    ],
    state: OrderState.SHIPPED,
    total_usd: 159.98,
    total_token: "159980000000000000000",
    shipping_option: MOCK_SHIPPING_OPTIONS[1],
    shipping_address: {
      name: "Alex Buyer",
      address1: "100 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      country: "US",
    },
    escrow: {
      escrowId: "escrow-001",
      contractAddress: "0x0000000000000000000000000000000000000001",
      tokenAddress: "0x0000000000000000000000000000000000000002",
      totalAmount: "159980000000000000000",
      remainingAmount: "111986000000000000000",
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      blockNumber: 12345678,
      createdAt: "2025-12-09T12:00:00Z",
    },
    payout_schedule: makePayoutSchedule(159980000000000000000),
    tracking_number: "9400111899221234567890",
    carrier: "USPS",
    label_url: "https://example.com/label-001.pdf",
    created_at: "2025-12-09T12:00:00Z",
    updated_at: "2025-12-11T10:30:00Z",
    state_history: [
      {
        from: OrderState.INITIATED,
        to: OrderState.ESCROWED,
        timestamp: "2025-12-09T12:01:00Z",
        txHash: "0x1234567890abcdef",
        triggeredBy: "buyer",
      },
      {
        from: OrderState.ESCROWED,
        to: OrderState.LABEL_CREATED,
        timestamp: "2025-12-10T14:00:00Z",
        txHash: "0xabc123",
        triggeredBy: "seller",
      },
      {
        from: OrderState.LABEL_CREATED,
        to: OrderState.SHIPPED,
        timestamp: "2025-12-11T10:00:00Z",
        txHash: "0xdef456",
        triggeredBy: "system",
      },
    ],
  },
  {
    id: "order-002",
    buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-002",
    seller_name: "HomeWork Studio",
    items: [
      {
        product_id: "prod-005",
        product_name: "Leather Laptop Bag",
        quantity: 1,
        price_usd: 179.0,
        image_url: MOCK_PRODUCTS[4].image_url,
      },
    ],
    state: OrderState.DELIVERED,
    total_usd: 184.99,
    total_token: "184990000000000000000",
    shipping_option: MOCK_SHIPPING_OPTIONS[2],
    shipping_address: {
      name: "Alex Buyer",
      address1: "100 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      country: "US",
    },
    escrow: {
      escrowId: "escrow-002",
      contractAddress: "0x0000000000000000000000000000000000000001",
      tokenAddress: "0x0000000000000000000000000000000000000002",
      totalAmount: "184990000000000000000",
      remainingAmount: "27748500000000000000",
      txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      blockNumber: 12345900,
      createdAt: "2025-12-01T09:00:00Z",
    },
    payout_schedule: [
      {
        state: OrderState.LABEL_CREATED,
        percentageBps: 1500,
        label: "Label Printed (15%)",
        releasedAt: "2025-12-02T11:00:00Z",
        txHash: "0xaaa111",
        amountToken: "27748500000000000000",
      },
      {
        state: OrderState.SHIPPED,
        percentageBps: 1500,
        label: "Shipped (15%)",
        releasedAt: "2025-12-03T09:00:00Z",
        txHash: "0xbbb222",
        amountToken: "27748500000000000000",
      },
      {
        state: OrderState.IN_TRANSIT,
        percentageBps: 2000,
        label: "In Transit (20%)",
        releasedAt: "2025-12-04T14:00:00Z",
        txHash: "0xccc333",
        amountToken: "36998000000000000000",
      },
      {
        state: OrderState.DELIVERED,
        percentageBps: 3500,
        label: "Delivered (35%)",
        releasedAt: "2025-12-06T10:00:00Z",
        txHash: "0xddd444",
        amountToken: "64746500000000000000",
      },
      {
        state: OrderState.FINALIZED,
        percentageBps: 1500,
        label: "Finalized (15%)",
      },
    ],
    tracking_number: "1Z999AA10123456784",
    carrier: "UPS",
    created_at: "2025-12-01T09:00:00Z",
    updated_at: "2025-12-06T10:30:00Z",
    state_history: [
      {
        from: OrderState.INITIATED,
        to: OrderState.ESCROWED,
        timestamp: "2025-12-01T09:01:00Z",
        triggeredBy: "buyer",
      },
      {
        from: OrderState.ESCROWED,
        to: OrderState.LABEL_CREATED,
        timestamp: "2025-12-02T11:00:00Z",
        triggeredBy: "seller",
      },
      {
        from: OrderState.LABEL_CREATED,
        to: OrderState.SHIPPED,
        timestamp: "2025-12-03T09:00:00Z",
        triggeredBy: "system",
      },
      {
        from: OrderState.SHIPPED,
        to: OrderState.IN_TRANSIT,
        timestamp: "2025-12-04T14:00:00Z",
        triggeredBy: "oracle",
      },
      {
        from: OrderState.IN_TRANSIT,
        to: OrderState.DELIVERED,
        timestamp: "2025-12-06T10:00:00Z",
        triggeredBy: "oracle",
      },
    ],
  },
];

// ─── Mock Payout Records ──────────────────────────────────────────────────

export const MOCK_PAYOUT_RECORDS: PayoutRecord[] = [
  {
    id: "payout-001",
    order_id: "order-001",
    state: OrderState.LABEL_CREATED,
    amount_token: "23997000000000000000",
    amount_usd: 23.997,
    tx_hash: "0xabc123",
    timestamp: "2025-12-10T14:00:00Z",
  },
  {
    id: "payout-002",
    order_id: "order-001",
    state: OrderState.SHIPPED,
    amount_token: "23997000000000000000",
    amount_usd: 23.997,
    tx_hash: "0xdef456",
    timestamp: "2025-12-11T10:00:00Z",
  },
  {
    id: "payout-003",
    order_id: "order-002",
    state: OrderState.DELIVERED,
    amount_token: "64746500000000000000",
    amount_usd: 64.7465,
    tx_hash: "0xddd444",
    timestamp: "2025-12-06T10:00:00Z",
  },
];

// ─── Mock Platform Analytics ──────────────────────────────────────────────

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

// ─── Mock Webhook Events ──────────────────────────────────────────────────

export const MOCK_WEBHOOK_EVENTS: WebhookEvent[] = [
  {
    id: "wh-001",
    event_type: "order.state_advanced",
    source: "contract",
    order_id: "order-001",
    payload: { orderId: "order-001", fromState: "ESCROWED", toState: "LABEL_CREATED" },
    status: "processed",
    http_status: 200,
    timestamp: "2025-12-10T14:00:05Z",
  },
  {
    id: "wh-002",
    event_type: "tracking.shipped",
    source: "shippo",
    order_id: "order-001",
    payload: { tracking_number: "9400111899221234567890", status: "TRANSIT" },
    status: "processed",
    http_status: 200,
    timestamp: "2025-12-11T10:00:12Z",
  },
  {
    id: "wh-003",
    event_type: "tracking.delivered",
    source: "shippo",
    order_id: "order-002",
    payload: { tracking_number: "1Z999AA10123456784", status: "DELIVERED" },
    status: "processed",
    http_status: 200,
    timestamp: "2025-12-06T10:00:08Z",
  },
  {
    id: "wh-004",
    event_type: "order.state_advanced",
    source: "contract",
    order_id: "order-002",
    payload: { orderId: "order-002", fromState: "IN_TRANSIT", toState: "DELIVERED" },
    status: "processed",
    http_status: 200,
    timestamp: "2025-12-06T10:00:30Z",
  },
];
