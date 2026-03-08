import { OrderState, type Order, type OrderItem, type PayoutSchedule, type StateTransition } from "@shivanshshrivas/flowstate/types";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type OrderRow = {
  id: string;
  buyer_user_id: string;
  buyer_wallet: string;
  seller_id: string;
  seller_name: string | null;
  state: OrderState;
  total_usd: number | string;
  total_token: string;
  shipping_option: unknown;
  shipping_address: unknown;
  escrow: unknown;
  tracking_number: string | null;
  carrier: string | null;
  label_url: string | null;
  created_at: string;
  updated_at: string;
};

type OrderItemRow = {
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price_usd: number | string;
  image_url: string | null;
};

type OrderStateHistoryRow = {
  order_id: string;
  from_state: OrderState;
  to_state: OrderState;
  timestamp: string;
  tx_hash: string | null;
  triggered_by: "buyer" | "seller" | "system" | "oracle";
  notes: string | null;
};

type OrderPayoutRow = {
  order_id: string;
  state: OrderState;
  percentage_bps: number;
  label: string;
  released_at: string | null;
  tx_hash: string | null;
  amount_token: string | null;
};

type Role = "buyer" | "seller" | "admin";

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

function getRole(user: User): Role {
  const role = user.user_metadata?.role;
  if (role === "seller" || role === "admin") return role;
  return "buyer";
}

async function getSellerIdForUser(user: User): Promise<string | null> {
  const fromMetadata = user.user_metadata?.seller_id;
  if (typeof fromMetadata === "string" && fromMetadata.length > 0) {
    return fromMetadata;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sellers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return (data as { id: string }).id;
}

function defaultPayoutSchedule(): PayoutSchedule[] {
  return [
    {
      state: OrderState.LABEL_CREATED,
      percentageBps: 1500,
      label: "Label Printed (15%)",
    },
    {
      state: OrderState.SHIPPED,
      percentageBps: 1500,
      label: "Shipped (15%)",
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
}

function defaultStateHistory(now: string): StateTransition[] {
  return [
    {
      from: OrderState.INITIATED,
      to: OrderState.ESCROWED,
      timestamp: now,
      triggeredBy: "buyer",
    },
  ];
}

function randomTxHash() {
  return `0x${Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("")}`;
}

function normalizeOrderItems(items: unknown): OrderItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      product_id: String(item.product_id ?? ""),
      product_name: String(item.product_name ?? ""),
      quantity: Math.max(1, toNumber(item.quantity, 1)),
      price_usd: toNumber(item.price_usd),
      image_url: item.image_url ? String(item.image_url) : undefined,
    }))
    .filter((item) => item.product_id && item.product_name);
}

function normalizePayoutSchedule(value: unknown): PayoutSchedule[] {
  if (!Array.isArray(value)) return defaultPayoutSchedule();

  const mapped = value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      state: String(item.state ?? "") as OrderState,
      percentageBps: toNumber(item.percentageBps),
      label: String(item.label ?? ""),
      releasedAt: item.releasedAt ? String(item.releasedAt) : undefined,
      txHash: item.txHash ? String(item.txHash) : undefined,
      amountToken: item.amountToken ? String(item.amountToken) : undefined,
    }))
    .filter((item) => Object.values(OrderState).includes(item.state));

  return mapped.length > 0 ? mapped : defaultPayoutSchedule();
}

function normalizeStateHistory(value: unknown, now: string): StateTransition[] {
  if (!Array.isArray(value)) return defaultStateHistory(now);

  const mapped = value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item): StateTransition => {
      const triggeredBy: StateTransition["triggeredBy"] =
        item.triggeredBy === "seller" ||
        item.triggeredBy === "system" ||
        item.triggeredBy === "oracle"
          ? item.triggeredBy
          : "buyer";

      return {
        from: String(item.from ?? "") as OrderState,
        to: String(item.to ?? "") as OrderState,
        timestamp: String(item.timestamp ?? now),
        txHash: item.txHash ? String(item.txHash) : undefined,
        triggeredBy,
        notes: item.notes ? String(item.notes) : undefined,
      };
    })
    .filter(
      (item) =>
        Object.values(OrderState).includes(item.from) &&
        Object.values(OrderState).includes(item.to)
    );

  return mapped.length > 0 ? mapped : defaultStateHistory(now);
}

function asOrder(
  row: OrderRow,
  itemsByOrderId: Map<string, OrderItem[]>,
  payoutsByOrderId: Map<string, PayoutSchedule[]>,
  stateHistoryByOrderId: Map<string, StateTransition[]>
): Order {
  return {
    id: row.id,
    buyer_wallet: row.buyer_wallet,
    seller_id: row.seller_id,
    seller_name: row.seller_name ?? undefined,
    items: itemsByOrderId.get(row.id) ?? [],
    state: row.state,
    total_usd: toNumber(row.total_usd),
    total_token: row.total_token,
    shipping_option: isRecord(row.shipping_option)
      ? {
          id: String(row.shipping_option.id ?? ""),
          carrier: String(row.shipping_option.carrier ?? ""),
          service: String(row.shipping_option.service ?? ""),
          price_usd: toNumber(row.shipping_option.price_usd),
          estimated_days: toNumber(row.shipping_option.estimated_days),
          logo: row.shipping_option.logo
            ? String(row.shipping_option.logo)
            : undefined,
        }
      : undefined,
    shipping_address: isRecord(row.shipping_address)
      ? {
          name: String(row.shipping_address.name ?? ""),
          address1: String(row.shipping_address.address1 ?? ""),
          address2: row.shipping_address.address2
            ? String(row.shipping_address.address2)
            : undefined,
          city: String(row.shipping_address.city ?? ""),
          state: String(row.shipping_address.state ?? ""),
          zip: String(row.shipping_address.zip ?? ""),
          country: String(row.shipping_address.country ?? "US"),
        }
      : undefined,
    escrow: isRecord(row.escrow)
      ? {
          escrowId: String(row.escrow.escrowId ?? ""),
          contractAddress: String(row.escrow.contractAddress ?? ""),
          tokenAddress: String(row.escrow.tokenAddress ?? ""),
          totalAmount: String(row.escrow.totalAmount ?? row.total_token),
          remainingAmount: String(row.escrow.remainingAmount ?? row.total_token),
          txHash: String(row.escrow.txHash ?? ""),
          blockNumber: toNumber(row.escrow.blockNumber),
          createdAt: String(row.escrow.createdAt ?? row.created_at),
        }
      : undefined,
    payout_schedule: payoutsByOrderId.get(row.id) ?? [],
    tracking_number: row.tracking_number ?? undefined,
    carrier: row.carrier ?? undefined,
    label_url: row.label_url ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    state_history: stateHistoryByOrderId.get(row.id) ?? [],
  };
}

async function buildOrderRelations(orderIds: string[]) {
  const empty = {
    itemsByOrderId: new Map<string, OrderItem[]>(),
    payoutsByOrderId: new Map<string, PayoutSchedule[]>(),
    stateHistoryByOrderId: new Map<string, StateTransition[]>(),
  };

  if (orderIds.length === 0) return empty;

  const supabase = await createSupabaseServerClient();

  const [itemsResult, payoutsResult, historyResult] = await Promise.all([
    supabase
      .from("order_items")
      .select("order_id,product_id,product_name,quantity,price_usd,image_url")
      .in("order_id", orderIds),
    supabase
      .from("order_payout_schedule")
      .select("order_id,state,percentage_bps,label,released_at,tx_hash,amount_token")
      .in("order_id", orderIds),
    supabase
      .from("order_state_history")
      .select("order_id,from_state,to_state,timestamp,tx_hash,triggered_by,notes")
      .in("order_id", orderIds)
      .order("timestamp", { ascending: true }),
  ]);

  const itemsByOrderId = new Map<string, OrderItem[]>();
  for (const row of (itemsResult.data ?? []) as OrderItemRow[]) {
    const list = itemsByOrderId.get(row.order_id) ?? [];
    list.push({
      product_id: row.product_id,
      product_name: row.product_name,
      quantity: row.quantity,
      price_usd: toNumber(row.price_usd),
      image_url: row.image_url ?? undefined,
    });
    itemsByOrderId.set(row.order_id, list);
  }

  const payoutsByOrderId = new Map<string, PayoutSchedule[]>();
  for (const row of (payoutsResult.data ?? []) as OrderPayoutRow[]) {
    const list = payoutsByOrderId.get(row.order_id) ?? [];
    list.push({
      state: row.state,
      percentageBps: row.percentage_bps,
      label: row.label,
      releasedAt: row.released_at ?? undefined,
      txHash: row.tx_hash ?? undefined,
      amountToken: row.amount_token ?? undefined,
    });
    payoutsByOrderId.set(row.order_id, list);
  }

  const stateHistoryByOrderId = new Map<string, StateTransition[]>();
  for (const row of (historyResult.data ?? []) as OrderStateHistoryRow[]) {
    const list = stateHistoryByOrderId.get(row.order_id) ?? [];
    list.push({
      from: row.from_state,
      to: row.to_state,
      timestamp: row.timestamp,
      txHash: row.tx_hash ?? undefined,
      triggeredBy: row.triggered_by,
      notes: row.notes ?? undefined,
    });
    stateHistoryByOrderId.set(row.order_id, list);
  }

  return { itemsByOrderId, payoutsByOrderId, stateHistoryByOrderId };
}

async function getOrderRowsForUser(user: User, orderId?: string) {
  const role = getRole(user);
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("orders")
    .select(
      "id,buyer_user_id,buyer_wallet,seller_id,seller_name,state,total_usd,total_token,shipping_option,shipping_address,escrow,tracking_number,carrier,label_url,created_at,updated_at"
    )
    .order("created_at", { ascending: false });

  if (orderId) {
    query = query.eq("id", orderId);
  }

  if (role === "admin") {
    const { data, error } = await query;
    if (error || !data) return [];
    return data as OrderRow[];
  }

  if (role === "seller") {
    const sellerId = await getSellerIdForUser(user);
    if (!sellerId) return [];
    const { data, error } = await query.eq("seller_id", sellerId);
    if (error || !data) return [];
    return data as OrderRow[];
  }

  const { data, error } = await query.eq("buyer_user_id", user.id);
  if (error || !data) return [];
  return data as OrderRow[];
}

export async function listOrdersForCurrentUser(user: User): Promise<Order[]> {
  if (!hasSupabaseConfig()) return [];

  const rows = await getOrderRowsForUser(user);
  const orderIds = rows.map((row) => row.id);
  const relations = await buildOrderRelations(orderIds);

  return rows.map((row) =>
    asOrder(row, relations.itemsByOrderId, relations.payoutsByOrderId, relations.stateHistoryByOrderId)
  );
}

export async function getOrderForCurrentUser(
  user: User,
  orderId: string
): Promise<Order | null> {
  if (!hasSupabaseConfig()) return null;

  const rows = await getOrderRowsForUser(user, orderId);
  const row = rows[0];
  if (!row) return null;

  const relations = await buildOrderRelations([row.id]);
  return asOrder(
    row,
    relations.itemsByOrderId,
    relations.payoutsByOrderId,
    relations.stateHistoryByOrderId
  );
}

function buildEscrow(orderId: string, totalToken: string, now: string) {
  return {
    escrowId: `escrow-${orderId}`,
    contractAddress: process.env.NEXT_PUBLIC_ESCROW_STATE_MACHINE_ADDRESS ?? "0x0",
    tokenAddress: process.env.NEXT_PUBLIC_MOCK_RLUSD_ADDRESS ?? "0x0",
    totalAmount: totalToken,
    remainingAmount: totalToken,
    txHash: randomTxHash(),
    blockNumber: 12345678,
    createdAt: now,
  };
}

function makeOrderId() {
  return `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function createOrderForCurrentUser(
  user: User,
  payload: Record<string, unknown>
): Promise<Order | null> {
  if (!hasSupabaseConfig()) return null;

  const items = normalizeOrderItems(payload.items);
  if (items.length === 0) return null;

  const sellerId = String(payload.seller_id ?? "").trim();
  if (!sellerId) return null;

  const shippingOption = isRecord(payload.shipping_option) ? payload.shipping_option : null;
  const shippingAddress = isRecord(payload.shipping_address) ? payload.shipping_address : null;
  if (!shippingOption || !shippingAddress) return null;

  const orderId = makeOrderId();
  const now = new Date().toISOString();
  const totalUsd = toNumber(payload.total_usd);
  const totalToken = String(payload.total_token ?? "0");
  const payoutSchedule = normalizePayoutSchedule(payload.payout_schedule);
  const stateHistory = normalizeStateHistory(payload.state_history, now);
  const state =
    payload.state === OrderState.DISPUTED
      ? OrderState.DISPUTED
      : (payload.state as OrderState) ?? OrderState.ESCROWED;

  const supabase = await createSupabaseServerClient();

  const orderInsert = {
    id: orderId,
    buyer_user_id: user.id,
    buyer_wallet: String(payload.buyer_wallet ?? user.user_metadata?.wallet_address ?? "0x0000"),
    seller_id: sellerId,
    seller_name: payload.seller_name ? String(payload.seller_name) : null,
    state,
    total_usd: totalUsd,
    total_token: totalToken,
    shipping_option: shippingOption,
    shipping_address: shippingAddress,
    escrow: isRecord(payload.escrow)
      ? payload.escrow
      : buildEscrow(orderId, totalToken, now),
    tracking_number: payload.tracking_number ? String(payload.tracking_number) : null,
    carrier: payload.carrier ? String(payload.carrier) : null,
    label_url: payload.label_url ? String(payload.label_url) : null,
    created_at: now,
    updated_at: now,
  };

  const { error: orderError } = await supabase.from("orders").insert(orderInsert);
  if (orderError) {
    return null;
  }

  const itemRows = items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    price_usd: item.price_usd,
    image_url: item.image_url ?? null,
  }));
  const { error: itemsError } = await supabase.from("order_items").insert(itemRows);
  if (itemsError) {
    return null;
  }

  const payoutRows = payoutSchedule.map((payout) => ({
    order_id: orderId,
    state: payout.state,
    percentage_bps: payout.percentageBps,
    label: payout.label,
    released_at: payout.releasedAt ?? null,
    tx_hash: payout.txHash ?? null,
    amount_token: payout.amountToken ?? null,
  }));
  if (payoutRows.length > 0) {
    const { error: payoutError } = await supabase
      .from("order_payout_schedule")
      .insert(payoutRows);
    if (payoutError) {
      return null;
    }
  }

  const historyRows = stateHistory.map((entry) => ({
    order_id: orderId,
    from_state: entry.from,
    to_state: entry.to,
    timestamp: entry.timestamp,
    tx_hash: entry.txHash ?? null,
    triggered_by: entry.triggeredBy,
    notes: entry.notes ?? null,
  }));
  if (historyRows.length > 0) {
    const { error: historyError } = await supabase
      .from("order_state_history")
      .insert(historyRows);
    if (historyError) {
      return null;
    }
  }

  return getOrderForCurrentUser(user, orderId);
}

export async function advanceOrderStateForCurrentUser(
  user: User,
  orderId: string,
  newState: OrderState
): Promise<Order | null> {
  if (!hasSupabaseConfig()) return null;

  const existing = await getOrderForCurrentUser(user, orderId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      state: newState,
      updated_at: now,
    })
    .eq("id", orderId);

  if (updateError) {
    return null;
  }

  const { error: historyError } = await supabase.from("order_state_history").insert({
    order_id: orderId,
    from_state: existing.state,
    to_state: newState,
    timestamp: now,
    tx_hash: randomTxHash(),
    triggered_by: getRole(user) === "seller" ? "seller" : "buyer",
    notes: "Manual demo advance",
  });

  if (historyError) {
    return null;
  }

  const payout = existing.payout_schedule.find((entry) => entry.state === newState);
  if (payout) {
    const amountToken =
      payout.amountToken ??
      ((BigInt(existing.total_token) * BigInt(payout.percentageBps)) / BigInt(10000)).toString();

    await supabase
      .from("order_payout_schedule")
      .update({
        released_at: now,
        tx_hash: randomTxHash(),
        amount_token: amountToken,
      })
      .eq("order_id", orderId)
      .eq("state", newState);
  }

  return getOrderForCurrentUser(user, orderId);
}
