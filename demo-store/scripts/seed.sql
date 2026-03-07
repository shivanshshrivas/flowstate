-- FlowState Demo Store — Supabase Migration
-- Run this in Supabase SQL editor or via supabase db push

-- ─── Users ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'admin')),
  wallet_address TEXT,
  seller_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Sellers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sellers (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  email TEXT NOT NULL,
  address JSONB NOT NULL,
  payout_config JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Products ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_usd NUMERIC(10, 2) NOT NULL,
  weight_oz NUMERIC(8, 2),
  dimensions JSONB,
  seller_id TEXT REFERENCES sellers(id),
  image_url TEXT,
  category TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Orders ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  buyer_wallet TEXT NOT NULL,
  seller_id TEXT REFERENCES sellers(id),
  items JSONB NOT NULL,
  state TEXT NOT NULL DEFAULT 'INITIATED',
  total_usd NUMERIC(10, 2) NOT NULL,
  total_token TEXT NOT NULL,
  shipping_option JSONB,
  shipping_address JSONB,
  escrow JSONB,
  payout_schedule JSONB NOT NULL DEFAULT '[]',
  tracking_number TEXT,
  carrier TEXT,
  label_url TEXT,
  state_history JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Webhook Events ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  order_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'received',
  http_status INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Platform Config ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Products: public read
CREATE POLICY "Products are publicly readable"
  ON products FOR SELECT USING (true);

-- Orders: buyers see their own orders
CREATE POLICY "Buyers see own orders"
  ON orders FOR SELECT
  USING (buyer_wallet = current_setting('app.wallet_address', true));

-- Orders: sellers see orders for their seller_id
CREATE POLICY "Sellers see their orders"
  ON orders FOR SELECT
  USING (seller_id = current_setting('app.seller_id', true));

-- ─── Seed Data ────────────────────────────────────────────────────────────
INSERT INTO sellers (id, business_name, wallet_address, email, address, payout_config, status)
VALUES
  (
    'seller-001',
    'TechGear Co.',
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    'seller@techgear.co',
    '{"name": "TechGear Co.", "address1": "1234 Tech Blvd", "city": "San Francisco", "state": "CA", "zip": "94102", "country": "US"}',
    '{"immediate_bps": 3000, "milestone_bps": 5500, "holdback_bps": 1500}',
    'active'
  ),
  (
    'seller-002',
    'HomeWork Studio',
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    'seller@homeworkstudio.com',
    '{"name": "HomeWork Studio", "address1": "5678 Design Ave", "city": "Brooklyn", "state": "NY", "zip": "11201", "country": "US"}',
    '{"immediate_bps": 3000, "milestone_bps": 5500, "holdback_bps": 1500}',
    'active'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_config (key, value) VALUES
  ('platform_fee_bps', '250'),
  ('grace_period_seconds', '604800')
ON CONFLICT (key) DO NOTHING;
