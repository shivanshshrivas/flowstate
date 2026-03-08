import {
  type PayoutConfig,
  type Seller,
  type ShippingAddress,
  type ShippingOption,
  type WebhookEvent,
} from "@shivanshshrivas/flowstate/types";
import type { Product } from "@/types/product";
import { MOCK_SELLERS, MOCK_WEBHOOK_EVENTS } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price_usd: number | string;
  weight_oz: number | string | null;
  dimensions: unknown;
  seller_id: string | null;
  image_url: string | null;
  category: string | null;
  stock: number | null;
  created_at: string;
};

type SellerRow = {
  id: string;
  user_id: string | null;
  business_name: string;
  wallet_address: string;
  email: string;
  address: unknown;
  payout_config: unknown;
  status: "pending" | "active" | "suspended";
  created_at: string;
};

type WebhookEventRow = {
  id: string;
  event_type: string;
  source: string;
  order_id: string | null;
  payload: unknown;
  status: "received" | "processed" | "failed";
  http_status: number | null;
  created_at: string;
};

type ShippingOptionRow = {
  id: string;
  carrier: string;
  service: string;
  price_usd: number | string;
  estimated_days: number;
  logo: string | null;
  active: boolean;
  created_at: string;
};

interface ProductFilters {
  category?: string | null;
  search?: string | null;
  sellerId?: string | null;
}

function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeDimensions(value: unknown) {
  if (!isRecord(value)) {
    return { length: 0, width: 0, height: 0 };
  }

  return {
    length: toNumber(value.length),
    width: toNumber(value.width),
    height: toNumber(value.height),
  };
}

function normalizeAddress(value: unknown): ShippingAddress {
  if (!isRecord(value)) {
    return {
      name: "",
      address1: "",
      city: "",
      state: "",
      zip: "",
      country: "US",
    };
  }

  return {
    name: String(value.name ?? ""),
    address1: String(value.address1 ?? ""),
    address2: value.address2 ? String(value.address2) : undefined,
    city: String(value.city ?? ""),
    state: String(value.state ?? ""),
    zip: String(value.zip ?? ""),
    country: String(value.country ?? "US"),
  };
}

function normalizePayoutConfig(value: unknown): PayoutConfig {
  if (!isRecord(value)) {
    return {
      immediate_bps: 3000,
      milestone_bps: 5500,
      holdback_bps: 1500,
    };
  }

  return {
    immediate_bps: toNumber(value.immediate_bps, 3000),
    milestone_bps: toNumber(value.milestone_bps, 5500),
    holdback_bps: toNumber(value.holdback_bps, 1500),
  };
}

function normalizeWebhookSource(source: string): WebhookEvent["source"] {
  if (source === "shippo" || source === "contract" || source === "manual") {
    return source;
  }
  return "manual";
}

function mapSeller(row: SellerRow): Seller {
  return {
    id: row.id,
    business_name: row.business_name,
    wallet_address: row.wallet_address,
    email: row.email,
    address: normalizeAddress(row.address),
    payout_config: normalizePayoutConfig(row.payout_config),
    status: row.status,
    created_at: row.created_at,
  };
}

function mapProduct(row: ProductRow, sellerName?: string): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    price_usd: toNumber(row.price_usd),
    weight_oz: toNumber(row.weight_oz),
    dimensions: normalizeDimensions(row.dimensions),
    seller_id: row.seller_id ?? "",
    seller_name: sellerName,
    image_url: row.image_url ?? "",
    category: row.category ?? "General",
    stock: row.stock ?? 0,
  };
}

function mapWebhookEvent(row: WebhookEventRow): WebhookEvent {
  return {
    id: row.id,
    event_type: row.event_type,
    source: normalizeWebhookSource(row.source),
    order_id: row.order_id ?? undefined,
    payload: isRecord(row.payload) ? row.payload : {},
    status: row.status,
    http_status: row.http_status ?? undefined,
    timestamp: row.created_at,
  };
}

function mapShippingOption(row: ShippingOptionRow): ShippingOption {
  return {
    id: row.id,
    carrier: row.carrier,
    service: row.service,
    price_usd: toNumber(row.price_usd),
    estimated_days: row.estimated_days,
    logo: row.logo ?? undefined,
  };
}

async function getSellerNameMap(sellerIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (sellerIds.length === 0) return map;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sellers")
    .select("id,business_name")
    .in("id", sellerIds);

  if (error || !data) {
    return map;
  }

  for (const seller of data as Array<{ id: string; business_name: string }>) {
    map.set(seller.id, seller.business_name);
  }

  return map;
}

export async function getProductsFromDatabase(filters: ProductFilters = {}): Promise<Product[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("products")
    .select(
      "id,name,description,price_usd,weight_oz,dimensions,seller_id,image_url,category,stock,created_at"
    )
    .order("created_at", { ascending: false });

  if (filters.category && filters.category !== "All") {
    query = query.eq("category", filters.category);
  }
  if (filters.sellerId) {
    query = query.eq("seller_id", filters.sellerId);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  const rows = data as ProductRow[];
  const sellerIds = Array.from(
    new Set(rows.map((row) => row.seller_id).filter((id): id is string => Boolean(id)))
  );
  const sellerNameMap = await getSellerNameMap(sellerIds);

  let products = rows.map((row) => mapProduct(row, sellerNameMap.get(row.seller_id ?? "")));
  if (filters.search) {
    const search = filters.search.toLowerCase();
    products = products.filter(
      (product) =>
        product.name.toLowerCase().includes(search) ||
        product.description.toLowerCase().includes(search)
    );
  }

  return products;
}

export async function getProductByIdFromDatabase(id: string): Promise<Product | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,name,description,price_usd,weight_oz,dimensions,seller_id,image_url,category,stock,created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as ProductRow;
  const sellerNames = await getSellerNameMap(row.seller_id ? [row.seller_id] : []);

  return mapProduct(row, sellerNames.get(row.seller_id ?? ""));
}

export async function getSellersFromDatabase(): Promise<Seller[]> {
  if (!hasSupabaseConfig()) return MOCK_SELLERS;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sellers")
    .select(
      "id,user_id,business_name,wallet_address,email,address,payout_config,status,created_at"
    )
    .order("created_at", { ascending: false });

  if (error || !data) {
    return MOCK_SELLERS;
  }

  return (data as SellerRow[]).map(mapSeller);
}

export async function getSellerByUserIdFromDatabase(
  userId: string
): Promise<Seller | null> {
  if (!hasSupabaseConfig()) {
    return MOCK_SELLERS[0] ?? null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sellers")
    .select(
      "id,user_id,business_name,wallet_address,email,address,payout_config,status,created_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapSeller(data as SellerRow);
}

export async function getWebhookEventsFromDatabase(limit = 20): Promise<WebhookEvent[]> {
  if (!hasSupabaseConfig()) {
    return MOCK_WEBHOOK_EVENTS.slice(0, limit);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("webhook_events")
    .select("id,event_type,source,order_id,payload,status,http_status,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return MOCK_WEBHOOK_EVENTS.slice(0, limit);
  }

  return (data as WebhookEventRow[]).map(mapWebhookEvent);
}

export async function getShippingOptionsFromDatabase(): Promise<ShippingOption[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("shipping_options")
    .select("id,carrier,service,price_usd,estimated_days,logo,active,created_at")
    .eq("active", true)
    .order("price_usd", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as ShippingOptionRow[]).map(mapShippingOption);
}

export function supabasePlatformEnabled() {
  return hasSupabaseConfig();
}
