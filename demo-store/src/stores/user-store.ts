import { create } from "zustand";
import type { UserRole } from "@shivanshshrivas/flowstate/types";

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  seller_id?: string;
  wallet_address?: string;
}

interface UserStore {
  user: AppUser | null;
  isLoading: boolean;
  syncFromSession: (
    supabaseUser: {
      id: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
    } | null
  ) => void;
  setWallet: (wallet: string) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  isLoading: true,

  syncFromSession: (supabaseUser) => {
    if (!supabaseUser) {
      set({ user: null, isLoading: false });
      return;
    }
    const role = (supabaseUser.user_metadata?.role as UserRole) ?? "buyer";
    set({
      user: {
        id: supabaseUser.id,
        email: supabaseUser.email ?? "",
        role,
        seller_id: supabaseUser.user_metadata?.seller_id as string | undefined,
        wallet_address: get().user?.wallet_address,
      },
      isLoading: false,
    });
  },

  setWallet: (wallet) => {
    const u = get().user;
    if (u) set({ user: { ...u, wallet_address: wallet } });
  },

  clearUser: () => set({ user: null, isLoading: false }),
}));
