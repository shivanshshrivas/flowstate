import { create } from "zustand";
import { type Order, OrderState } from "@/lib/flowstate/types";
import { MOCK_ORDERS } from "@/lib/mock-data";

interface OrderStore {
  orders: Order[];
  isLoading: boolean;

  fetchOrders: () => Promise<void>;
  getOrder: (id: string) => Order | undefined;
  addOrder: (order: Order) => void;
  advanceOrderState: (orderId: string, newState: OrderState) => void;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: MOCK_ORDERS,
  isLoading: false,

  fetchOrders: async () => {
    set({ isLoading: true });
    // TODO: fetch from API when backend is ready
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 500));
    set({ orders: MOCK_ORDERS, isLoading: false });
  },

  getOrder: (id) => get().orders.find((o) => o.id === id),

  addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),

  advanceOrderState: (orderId, newState) => {
    set((state) => ({
      orders: state.orders.map((o) => {
        if (o.id !== orderId) return o;
        const now = new Date().toISOString();
        return {
          ...o,
          state: newState,
          updated_at: now,
          state_history: [
            ...o.state_history,
            {
              from: o.state,
              to: newState,
              timestamp: now,
              triggeredBy: "seller" as const,
              notes: "Manual demo advance",
            },
          ],
          payout_schedule: o.payout_schedule.map((p) =>
            p.state === newState
              ? { ...p, releasedAt: now, txHash: `0x${Math.random().toString(16).slice(2)}` }
              : p
          ),
        };
      }),
    }));
  },
}));
