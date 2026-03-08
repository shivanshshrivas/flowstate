import { create } from "zustand";
import { type Order, OrderState } from "@shivanshshrivas/flowstate/types";

interface OrderStore {
  orders: Order[];
  isLoading: boolean;

  fetchOrders: () => Promise<void>;
  getOrder: (id: string) => Order | undefined;
  addOrder: (order: Order) => void;
  advanceOrderState: (orderId: string, newState: OrderState) => Promise<void>;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],
  isLoading: false,

  fetchOrders: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      if (!response.ok) {
        set({ orders: [], isLoading: false });
        return;
      }

      const payload = (await response.json()) as { orders?: Order[] };
      set({ orders: payload.orders ?? [], isLoading: false });
    } catch {
      set({ orders: [], isLoading: false });
    }
  },

  getOrder: (id) => get().orders.find((o) => o.id === id),

  addOrder: (order) =>
    set((state) => {
      const existing = state.orders.find((entry) => entry.id === order.id);
      if (existing) {
        return {
          orders: state.orders.map((entry) => (entry.id === order.id ? order : entry)),
        };
      }

      return { orders: [order, ...state.orders] };
    }),

  advanceOrderState: async (orderId, newState) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: newState }),
      });

      if (!response.ok) return;
      const payload = (await response.json()) as { order?: Order };
      if (!payload.order) return;

      set((state) => ({
        orders: state.orders.map((order) =>
          order.id === orderId ? payload.order! : order
        ),
      }));
    } catch {
      // Ignore network errors in demo state controls.
    }
  },
}));