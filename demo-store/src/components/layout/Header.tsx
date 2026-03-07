"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ShoppingCart, Zap, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/", label: "Store" },
  { href: "/orders", label: "My Orders" },
  { href: "/seller", label: "Seller Dashboard" },
  { href: "/admin", label: "Admin" },
  { href: "/faucet", label: "Faucet" },
];

export function Header() {
  const pathname = usePathname();
  const cartItemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-neutral-100 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="hidden sm:block">FlowState</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Link href="/cart" className="relative">
              <Button variant="ghost" size="icon">
                <ShoppingCart className="h-5 w-5" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-violet-600 text-xs text-white flex items-center justify-center font-medium">
                    {cartItemCount}
                  </span>
                )}
              </Button>
            </Link>
            <ConnectButton accountStatus="avatar" showBalance={false} />
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-neutral-800 bg-neutral-950 px-4 py-3 space-y-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block px-3 py-2 rounded-lg text-sm font-medium",
                pathname === link.href
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
