"use client";

import { useEffect, useState } from "react";
import { SellerDashboard } from "@flowstate/gateway";
import { RequireRole } from "@/components/guards/RequireRole";
import { useUserStore } from "@/stores/user-store";
import type { Seller } from "@/lib/flowstate/types";

const DEFAULT_SELLER_ID = "seller-001";

function SellerDashboardContent() {
  const { user } = useUserStore();
  const [sellerId, setSellerId] = useState<string>(user?.seller_id ?? DEFAULT_SELLER_ID);

  useEffect(() => {
    let cancelled = false;

    async function loadSellerId() {
      try {
        const response = await fetch("/api/sellers?mine=true", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { seller?: Seller | null };
        if (!cancelled && payload.seller?.id) {
          setSellerId(payload.seller.id);
        }
      } catch {
        if (!cancelled && user?.seller_id) {
          setSellerId(user.seller_id);
        }
      }
    }

    loadSellerId();
    return () => { cancelled = true; };
  }, [user?.seller_id]);

  return <SellerDashboard sellerId={sellerId} />;
}

export default function SellerDashboardPage() {
  return (
    <RequireRole roles={["seller", "admin"]}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <SellerDashboardContent />
      </div>
    </RequireRole>
  );
}
