-- FlowState Demo Store — Supabase Migration
-- Run in Supabase SQL editor (Database > SQL Editor > New query)
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT DO NOTHING)

-- ─── Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users (mirrors auth.users, auto-populated via trigger) ────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'buyer'
                  CHECK (role IN ('buyer', 'seller', 'admin')),
  wallet_address TEXT,
  seller_id     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Sellers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sellers (
  id              TEXT PRIMARY KEY,
  user_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  business_name   TEXT NOT NULL,
  wallet_address  TEXT NOT NULL,
  email           TEXT NOT NULL,
  address         JSONB NOT NULL DEFAULT '{}',
  payout_config   JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'suspended')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Products ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  price_usd   NUMERIC(10, 2) NOT NULL,
  weight_oz   NUMERIC(8, 2),
  dimensions  JSONB,
  seller_id   TEXT REFERENCES public.sellers(id) ON DELETE SET NULL,
  image_url   TEXT,
  category    TEXT,
  stock       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Platform Config ──────────────────────────────────────────────────────
-- Stores gateway integration config (flowstate_project_id, api_key, fee_bps)
CREATE TABLE IF NOT EXISTS public.platform_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Webhook Events (logged by /api/webhooks/flowstate) ───────────────────
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_type  TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'flowstate',
  order_id    TEXT,
  payload     JSONB NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'received',
  http_status INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Trigger: auto-create users row on auth signup ────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Helper: get current user's role ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
    'buyer'
  );
$$;

-- ─── Row Level Security ───────────────────────────────────────────────────
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events  ENABLE ROW LEVEL SECURITY;

-- users: read/update own row; admin reads all
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (id = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

-- sellers: public read; owner or admin can update
CREATE POLICY "sellers_select_all"
  ON public.sellers FOR SELECT USING (true);

CREATE POLICY "sellers_insert_own"
  ON public.sellers FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "sellers_update_own"
  ON public.sellers FOR UPDATE
  USING (user_id = auth.uid() OR public.current_user_role() = 'admin');

-- products: public read; seller owner or admin can write
CREATE POLICY "products_select_all"
  ON public.products FOR SELECT USING (true);

CREATE POLICY "products_insert_own"
  ON public.products FOR INSERT
  WITH CHECK (
    public.current_user_role() IN ('seller', 'admin')
  );

CREATE POLICY "products_update_own"
  ON public.products FOR UPDATE
  USING (
    seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
    OR public.current_user_role() = 'admin'
  );

-- platform_config: admin only
CREATE POLICY "platform_config_admin"
  ON public.platform_config FOR ALL
  USING (public.current_user_role() = 'admin');

-- webhook_events: admin only
CREATE POLICY "webhook_events_admin"
  ON public.webhook_events FOR ALL
  USING (public.current_user_role() = 'admin');

-- ─── Seed: Sellers ────────────────────────────────────────────────────────
INSERT INTO public.sellers (id, business_name, wallet_address, email, address, payout_config, status)
VALUES
  (
    'seller-001',
    'TechGear Co.',
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    'seller@demo.com',
    '{"name": "TechGear Co.", "address1": "1234 Tech Blvd", "city": "San Francisco", "state": "CA", "zip": "94102", "country": "US"}',
    '{"immediate_bps": 3000, "milestone_bps": 5500, "holdback_bps": 1500}',
    'active'
  ),
  (
    'seller-002',
    'HomeWork Studio',
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    'seller2@demo.com',
    '{"name": "HomeWork Studio", "address1": "5678 Design Ave", "city": "Brooklyn", "state": "NY", "zip": "11201", "country": "US"}',
    '{"immediate_bps": 3000, "milestone_bps": 5500, "holdback_bps": 1500}',
    'active'
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Seed: Products ───────────────────────────────────────────────────────
INSERT INTO public.products (id, name, description, price_usd, weight_oz, dimensions, seller_id, image_url, category, stock)
VALUES
  (
    'prod-001',
    'Mechanical Keyboard – TKL Pro',
    'Tenkeyless mechanical keyboard with Cherry MX Red switches. Hot-swap PCB, RGB per-key lighting, aluminum case.',
    149.99, 22,
    '{"length": 14, "width": 5, "height": 1.5}',
    'seller-001',
    'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
    'Electronics', 12
  ),
  (
    'prod-002',
    'Noise Cancelling Headphones',
    'Over-ear wireless headphones with 40-hour battery life, ANC, and studio-grade audio.',
    249.00, 11,
    '{"length": 8, "width": 7, "height": 3.5}',
    'seller-001',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
    'Electronics', 8
  ),
  (
    'prod-003',
    'Ergonomic Office Chair',
    'Lumbar support, breathable mesh back, adjustable armrests and seat height. Built for 8-hour workdays.',
    399.00, 480,
    '{"length": 28, "width": 28, "height": 48}',
    'seller-002',
    'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=800&q=80',
    'Furniture', 5
  ),
  (
    'prod-004',
    '4K Webcam – StreamPro',
    'Ultra-sharp 4K webcam with built-in ring light and auto-focus. Perfect for streaming and video calls.',
    89.99, 6,
    '{"length": 4, "width": 2, "height": 2}',
    'seller-001',
    'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80',
    'Electronics', 20
  ),
  (
    'prod-005',
    'Leather Laptop Bag',
    'Full-grain leather laptop bag fits up to 16". Padded laptop sleeve, organizer pockets.',
    179.00, 28,
    '{"length": 17, "width": 12, "height": 4}',
    'seller-002',
    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80',
    'Accessories', 15
  ),
  (
    'prod-006',
    'Desk Lamp – Arc Pro',
    'LED desk lamp with wireless charging base, adjustable arm, 5 color temperatures.',
    79.00, 32,
    '{"length": 6, "width": 6, "height": 18}',
    'seller-002',
    'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80',
    'Furniture', 30
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Seed: Platform Config ────────────────────────────────────────────────
INSERT INTO public.platform_config (key, value)
VALUES
  ('platform_fee_bps',      '250'),
  ('grace_period_seconds',  '604800'),
  ('flowstate_project_id',  '"demo-project-001"'),
  ('gateway_enabled',       'false')
ON CONFLICT (key) DO NOTHING;

-- ─── Demo Auth Users ──────────────────────────────────────────────────────
-- Create these manually in Supabase Dashboard > Authentication > Users
-- or via the Supabase CLI:
--
--   supabase auth users create --email buyer@demo.com  --password demo1234 --data '{"role":"buyer"}'
--   supabase auth users create --email seller@demo.com --password demo1234 --data '{"role":"seller"}'
--   supabase auth users create --email admin@demo.com  --password demo1234 --data '{"role":"admin"}'
--
-- The on_auth_user_created trigger will auto-populate public.users for each.
