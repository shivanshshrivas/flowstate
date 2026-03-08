"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, BarChart3, Clock, DollarSign, Loader2, Package, Shield } from "lucide-react";
import { useFlowState } from "./FlowStateProvider";
import { AgentChat } from "./AgentChat";
import {
  type PlatformAnalytics,
  type Seller,
  type WebhookEvent,
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ state }: { state: OrderState }) {
  const colors: Partial<Record<OrderState, string>> = {
    [OrderState.DISPUTED]: "bg-red-900/60 text-red-300",
    [OrderState.FINALIZED]: "bg-green-900/60 text-green-300",
    [OrderState.DELIVERED]: "bg-emerald-900/60 text-emerald-300",
    [OrderState.IN_TRANSIT]: "bg-indigo-900/60 text-indigo-300",
    [OrderState.ESCROWED]: "bg-violet-900/60 text-violet-300",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", colors[state] ?? "bg-neutral-700 text-neutral-300")}>
      {ORDER_STATE_LABELS[state]}
    </span>
  );
}

export interface AdminDashboardProps {
  projectId: string;
  className?: string;
}

export function AdminDashboard({ projectId, className }: AdminDashboardProps) {
  const { apiClient } = useFlowState();
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"analytics" | "sellers" | "webhooks" | "chat">("analytics");

  const loadData = useCallback(async () => {
    if (!apiClient) { setError("API client not configured"); setLoading(false); return; }
    try {
      setLoading(true);
      const [analyticsData, sellersData, logsData] = await Promise.all([
        apiClient.getPlatformAnalytics(projectId),
        apiClient.getPlatformSellers(projectId),
        apiClient.getWebhookLogs({ limit: 50 }),
      ]);
      setAnalytics(analyticsData);
      setSellers(sellersData.sellers);
      setWebhookLogs(logsData.logs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load platform data");
    } finally {
      setLoading(false);
    }
  }, [apiClient, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const tabs = [
    { key: "analytics" as const, label: "Analytics" },
    { key: "sellers" as const, label: "Sellers" },
    { key: "webhooks" as const, label: "Webhooks" },
    { key: "chat" as const, label: "Admin Agent" },
  ];

  return (
    <div className={cn("mx-auto max-w-7xl space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-100">Admin Dashboard</h2>
          <p className="text-sm text-neutral-400">Project: {projectId}</p>
        </div>
        <button
          onClick={loadData}
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
          {activeTab === "analytics" && analytics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { icon: Package, label: "Total Orders", value: analytics.total_orders.toString(), color: "text-violet-400" },
                  { icon: DollarSign, label: "Total Volume", value: formatUsd(analytics.total_volume_usd), color: "text-emerald-400" },
                  { icon: Shield, label: "Active Escrows", value: analytics.active_escrows.toString(), color: "text-blue-400" },
                  { icon: AlertTriangle, label: "Dispute Rate", value: `${(analytics.dispute_rate * 100).toFixed(1)}%`, color: "text-amber-400" },
                  { icon: Clock, label: "Avg Resolution", value: `${analytics.avg_resolution_hours.toFixed(1)}h`, color: "text-indigo-400" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800">
                        <Icon className={cn("h-4 w-4", color)} />
                      </div>
                      <p className="text-sm text-neutral-400">{label}</p>
                    </div>
                    <p className="text-2xl font-bold text-neutral-100">{value}</p>
                  </div>
                ))}
              </div>

              {analytics.orders_by_day.length > 0 && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-neutral-400" />
                    <h3 className="text-sm font-semibold text-neutral-200">Orders (Last 14 Days)</h3>
                  </div>
                  <div className="space-y-1">
                    {analytics.orders_by_day.slice(-7).map((day) => {
                      const maxCount = Math.max(...analytics.orders_by_day.map((d) => d.count), 1);
                      const pct = (day.count / maxCount) * 100;
                      return (
                        <div key={day.date} className="flex items-center gap-2">
                          <span className="w-20 text-right text-xs text-neutral-500">{day.date.slice(5)}</span>
                          <div className="flex-1 rounded-full bg-neutral-800 h-2 overflow-hidden">
                            <div className="h-2 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-8 text-right text-xs text-neutral-400">{day.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "sellers" && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900">
              <div className="border-b border-neutral-800 p-4">
                <h3 className="font-semibold text-neutral-100">Platform Sellers</h3>
              </div>
              {sellers.length === 0 ? (
                <div className="p-8 text-center text-sm text-neutral-500">No sellers yet.</div>
              ) : (
                <div className="divide-y divide-neutral-800">
                  {sellers.map((seller) => (
                    <div key={seller.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium text-neutral-200">{seller.business_name}</p>
                        <p className="text-xs text-neutral-500">{seller.email} · {seller.wallet_address.slice(0, 10)}...</p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          seller.status === "active" ? "bg-emerald-900/60 text-emerald-300" :
                          seller.status === "suspended" ? "bg-red-900/60 text-red-300" :
                          "bg-neutral-700 text-neutral-300"
                        )}
                      >
                        {seller.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "webhooks" && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900">
              <div className="border-b border-neutral-800 p-4">
                <h3 className="font-semibold text-neutral-100">Webhook Logs</h3>
              </div>
              {webhookLogs.length === 0 ? (
                <div className="p-8 text-center text-sm text-neutral-500">No webhook events yet.</div>
              ) : (
                <div className="divide-y divide-neutral-800">
                  {webhookLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-neutral-200">{log.event_type}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                          <span>{formatDateTime(log.timestamp)}</span>
                          {log.order_id && <span>· {log.order_id.slice(0, 8)}</span>}
                          <span>· {log.source}</span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          log.status === "processed" ? "bg-emerald-900/60 text-emerald-300" :
                          log.status === "failed" ? "bg-red-900/60 text-red-300" :
                          "bg-neutral-700 text-neutral-300"
                        )}
                      >
                        {log.http_status ? `${log.http_status} · ` : ""}{log.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "chat" && (
            <AgentChat role="admin" userId={projectId} variant="panel" className="h-[32rem]" placeholder="Ask about analytics, sellers, or webhook issues..." />
          )}
        </>
      )}
    </div>
  );
}
