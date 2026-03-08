"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  Package,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { useFlowState } from "./FlowStateProvider";
import { EscrowProgressBar } from "./EscrowProgressBar";
import { AgentChat } from "./AgentChat";
import {
  type Order,
  type PayoutRecord,
  type SellerMetrics,
  OrderState,
  ORDER_STATE_LABELS,
} from "../types/index";
import { clsx } from "clsx";

function cn(...args: Parameters<typeof clsx>) {
  return clsx(...args);
}

function formatUsd(usd: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(usd);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const XRPL_EXPLORER = "https://explorer.testnet.xrplevm.org";

type SellerOrderFilter = "all" | "needs_action" | "in_transit" | "completed";

const NEXT_STATES: Partial<Record<OrderState, OrderState>> = {
  [OrderState.ESCROWED]: OrderState.LABEL_CREATED,
  [OrderState.LABEL_CREATED]: OrderState.SHIPPED,
};

const ACTION_LABELS: Partial<Record<OrderState, string>> = {
  [OrderState.ESCROWED]: "Confirm Label Printed",
  [OrderState.LABEL_CREATED]: "Confirm Shipped",
};

const FILTERS: { key: SellerOrderFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_action", label: "Needs Action" },
  { key: "in_transit", label: "In Transit" },
  { key: "completed", label: "Completed" },
];

function StateBadge({ state }: { state: OrderState }) {
  const colors: Record<OrderState, string> = {
    [OrderState.INITIATED]: "bg-neutral-700 text-neutral-300",
    [OrderState.ESCROWED]: "bg-violet-900/60 text-violet-300",
    [OrderState.LABEL_CREATED]: "bg-blue-900/60 text-blue-300",
    [OrderState.SHIPPED]: "bg-cyan-900/60 text-cyan-300",
    [OrderState.IN_TRANSIT]: "bg-indigo-900/60 text-indigo-300",
    [OrderState.DELIVERED]: "bg-emerald-900/60 text-emerald-300",
    [OrderState.FINALIZED]: "bg-green-900/60 text-green-300",
    [OrderState.DISPUTED]: "bg-red-900/60 text-red-300",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", colors[state])}>
      {ORDER_STATE_LABELS[state]}
    </span>
  );
}

function toBigInt(order: Order): bigint {
  try { return BigInt(order.total_token); } catch { return BigInt(Math.round(order.total_usd * 1e18)); }
}

function deriveMetrics(orders: Order[]): SellerMetrics {
  let totalRevenueToken = BigInt(0);
  let pendingPayoutToken = BigInt(0);
  let activeEscrows = 0;
  let disputeCount = 0;
  let fulfillmentHoursTotal = 0;
  let fulfillmentSamples = 0;

  for (const order of orders) {
    const orderToken = toBigInt(order);
    totalRevenueToken += orderToken;

    if ([OrderState.INITIATED, OrderState.ESCROWED, OrderState.LABEL_CREATED, OrderState.SHIPPED, OrderState.IN_TRANSIT].includes(order.state)) {
      activeEscrows++;
    }
    if (order.state === OrderState.DISPUTED) disputeCount++;

    const releasedBps = order.payout_schedule.reduce((s, p) => p.releasedAt ? s + p.percentageBps : s, 0);
    pendingPayoutToken += (orderToken * BigInt(Math.max(0, 10000 - releasedBps))) / BigInt(10000);

    const shipped = order.state_history.find((t) => t.to === OrderState.SHIPPED);
    if (shipped) {
      const diff = Date.parse(shipped.timestamp) - Date.parse(order.created_at);
      if (diff > 0) { fulfillmentHoursTotal += diff / 3600000; fulfillmentSamples++; }
    }
  }

  return {
    total_orders: orders.length,
    total_revenue_usd: orders.reduce((s, o) => s + o.total_usd, 0),
    total_revenue_token: totalRevenueToken.toString(),
    fulfillment_avg_hours: fulfillmentSamples > 0 ? fulfillmentHoursTotal / fulfillmentSamples : 0,
    dispute_rate: orders.length > 0 ? disputeCount / orders.length : 0,
    active_escrows: activeEscrows,
    pending_payouts_token: pendingPayoutToken.toString(),
  };
}

function derivePayouts(orders: Order[]): PayoutRecord[] {
  const records: PayoutRecord[] = [];
  for (const order of orders) {
    const orderToken = toBigInt(order);
    order.payout_schedule.forEach((p, i) => {
      if (!p.releasedAt && !p.txHash) return;
      records.push({
        id: `${order.id}-${p.state}-${i}`,
        order_id: order.id,
        state: p.state,
        amount_token: p.amountToken ?? ((orderToken * BigInt(p.percentageBps)) / BigInt(10000)).toString(),
        amount_usd: (order.total_usd * p.percentageBps) / 10000,
        tx_hash: p.txHash ?? `pending-${order.id}`,
        timestamp: p.releasedAt ?? order.updated_at,
      });
    });
  }
  return records.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export interface SellerDashboardProps {
  sellerId: string;
  onConfirmLabel?: (orderId: string) => void;
  onRespondDispute?: (disputeId: string) => void;
  className?: string;
}

export function SellerDashboard({ sellerId, onConfirmLabel, onRespondDispute, className }: SellerDashboardProps) {
  const { apiClient } = useFlowState();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "payouts" | "metrics" | "chat">("orders");
  const [activeFilter, setActiveFilter] = useState<SellerOrderFilter>("all");
  const [advancingOrder, setAdvancingOrder] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!apiClient) { setError("API client not configured"); setLoading(false); return; }
    try {
      setLoading(true);
      const result = await apiClient.getSellerOrders(sellerId);
      setOrders(result.orders);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [apiClient, sellerId]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  async function handleConfirmLabel(order: Order) {
    if (!apiClient) return;
    setAdvancingOrder(order.id);
    try {
      if (order.state === OrderState.ESCROWED) {
        await apiClient.confirmLabelPrinted(order.id, { seller_wallet: "" });
        onConfirmLabel?.(order.id);
      }
      await loadOrders();
    } catch (e) {
      console.error("Failed to advance order:", e);
    } finally {
      setAdvancingOrder(null);
    }
  }

  const filteredOrders = useMemo(() => orders.filter((o) => {
    if (activeFilter === "needs_action") return o.state === OrderState.ESCROWED || o.state === OrderState.LABEL_CREATED;
    if (activeFilter === "in_transit") return o.state === OrderState.SHIPPED || o.state === OrderState.IN_TRANSIT;
    if (activeFilter === "completed") return o.state === OrderState.DELIVERED || o.state === OrderState.FINALIZED;
    return true;
  }), [orders, activeFilter]);

  const metrics = useMemo(() => deriveMetrics(orders), [orders]);
  const payouts = useMemo(() => derivePayouts(orders), [orders]);

  const tabs = [
    { key: "orders" as const, label: "Orders" },
    { key: "payouts" as const, label: "Payouts" },
    { key: "metrics" as const, label: "Metrics" },
    { key: "chat" as const, label: "Seller Agent" },
  ];

  return (
    <div className={cn("mx-auto max-w-7xl space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-100">Seller Dashboard</h2>
          <p className="text-sm text-neutral-400">Seller ID: {sellerId}</p>
        </div>
        <button
          onClick={loadOrders}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-neutral-800 bg-neutral-900 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {activeTab === "orders" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setActiveFilter(f.key)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      activeFilter === f.key
                        ? "bg-violet-600 text-white"
                        : "border border-neutral-700 text-neutral-400 hover:text-neutral-200"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
                  <Package className="mb-3 h-10 w-10 opacity-40" />
                  <p className="text-sm">No orders match this filter.</p>
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const nextState = NEXT_STATES[order.state];
                  const actionLabel = ACTION_LABELS[order.state];
                  const isAdvancing = advancingOrder === order.id;

                  return (
                    <div key={order.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-neutral-400">{order.id}</span>
                            <StateBadge state={order.state} />
                          </div>
                          <p className="text-sm text-neutral-300">
                            {order.items.map((i) => i.product_name).join(", ")}
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500">
                            <span>{formatDate(order.created_at)}</span>
                            <span>{formatUsd(order.total_usd)}</span>
                            {order.tracking_number && (
                              <span className="font-mono">{order.carrier} | {order.tracking_number.slice(0, 12)}...</span>
                            )}
                          </div>
                          <EscrowProgressBar
                            className="mt-3"
                            state={order.state}
                            payoutSchedule={order.payout_schedule}
                            compact
                            isDisputed={order.state === OrderState.DISPUTED}
                          />
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {order.label_url && (
                            <a href={order.label_url} target="_blank" rel="noopener noreferrer">
                              <button className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 transition-colors">
                                <Download className="h-3.5 w-3.5" />
                                Label
                              </button>
                            </a>
                          )}
                          {nextState && actionLabel && (
                            <button
                              onClick={() => handleConfirmLabel(order)}
                              disabled={isAdvancing}
                              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
                            >
                              {isAdvancing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5" />
                              )}
                              {actionLabel}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "payouts" && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <h3 className="mb-4 text-base font-semibold text-neutral-100">Payout History</h3>
              {payouts.length === 0 ? (
                <p className="text-sm text-neutral-500">No payout releases yet.</p>
              ) : (
                <div className="divide-y divide-neutral-800">
                  {payouts.map((payout) => (
                    <div key={payout.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-neutral-200">
                          {payout.state.replace(/_/g, " ")} · Order {payout.order_id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-neutral-500">{formatDateTime(payout.timestamp)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-400">+{formatUsd(payout.amount_usd)}</p>
                        <a
                          href={`${XRPL_EXPLORER}/tx/${payout.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-end gap-0.5 text-xs text-neutral-500 hover:text-neutral-300"
                        >
                          tx <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "metrics" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Package, label: "Total Orders", value: metrics.total_orders.toString(), sub: `${metrics.active_escrows} in progress`, color: "text-violet-400" },
                { icon: DollarSign, label: "Total Revenue", value: formatUsd(metrics.total_revenue_usd), sub: `${formatUsd(Number(metrics.pending_payouts_token) / 1e18)} pending`, color: "text-emerald-400" },
                { icon: Clock, label: "Avg Fulfillment", value: `${metrics.fulfillment_avg_hours.toFixed(1)}h`, sub: "order to shipped", color: "text-blue-400" },
                { icon: AlertTriangle, label: "Dispute Rate", value: `${(metrics.dispute_rate * 100).toFixed(1)}%`, sub: "of total orders", color: "text-amber-400" },
                { icon: TrendingUp, label: "Active Escrows", value: metrics.active_escrows.toString(), sub: "awaiting fulfillment", color: "text-violet-400" },
              ].map(({ icon: Icon, label, value, sub, color }) => (
                <div key={label} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800">
                      <Icon className={cn("h-4 w-4", color)} />
                    </div>
                    <p className="text-sm text-neutral-400">{label}</p>
                  </div>
                  <p className="text-2xl font-bold text-neutral-100">{value}</p>
                  <p className="mt-1 text-xs text-neutral-500">{sub}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === "chat" && (
            <AgentChat role="seller" userId={sellerId} variant="panel" className="h-[32rem]" placeholder="Ask about your orders, payouts, or metrics..." />
          )}
        </>
      )}
    </div>
  );
}
