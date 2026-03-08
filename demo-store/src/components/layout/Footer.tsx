"use client";

import Link from "next/link";
import { Zap, ExternalLink } from "lucide-react";
import { useUserStore } from "@/stores/user-store";

export function Footer() {
  const user = useUserStore((s) => s.user);
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const isSeller = supabaseConfigured && user?.role === "seller";

  return (
    <footer className="border-t border-neutral-800 bg-neutral-950 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-neutral-400 text-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-violet-600">
              <Zap className="h-3 w-3 text-white" />
            </div>
            <span>Demo Store</span>
            <span className="text-neutral-600">—</span>
            <span>Powered by XRPL EVM Sidechain</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="https://explorer.testnet.xrplevm.org"
              target="_blank"
              className="text-neutral-500 hover:text-neutral-300 flex items-center gap-1 transition-colors"
            >
              Explorer <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="/faucet"
              className="text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Faucet
            </Link>
            {!isSeller && (
              <Link
                href="/seller/signup"
                className="text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Become a Seller
              </Link>
            )}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-neutral-600">
          This is a demo application. All payments use MockRLUSD (FLUSD) on XRPL EVM Testnet.
        </p>
      </div>
    </footer>
  );
}
