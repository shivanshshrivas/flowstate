import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Product, type ShippingOption, type ShippingAddress } from "@/lib/flowstate/types";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  shippingOption: ShippingOption | null;
  shippingAddress: ShippingAddress | null;

  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setShippingOption: (option: ShippingOption) => void;
  setShippingAddress: (address: ShippingAddress) => void;

  // Computed
  totalItems: () => number;
  subtotalUsd: () => number;
  totalUsd: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      shippingOption: null,
      shippingAddress: null,

      addItem: (product, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i.product.id === product.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product.id === product.id
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
            };
          }
          return { items: [...state.items, { product, quantity }] };
        });
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.product.id !== productId),
        }));
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.product.id === productId ? { ...i, quantity } : i
          ),
        }));
      },

      clearCart: () => set({ items: [], shippingOption: null, shippingAddress: null }),

      setShippingOption: (option) => set({ shippingOption: option }),
      setShippingAddress: (address) => set({ shippingAddress: address }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      subtotalUsd: () =>
        get().items.reduce((sum, i) => sum + i.product.price_usd * i.quantity, 0),
      totalUsd: () =>
        get().subtotalUsd() + (get().shippingOption?.price_usd ?? 0),
    }),
    { name: "flowstate-cart" }
  )
);
