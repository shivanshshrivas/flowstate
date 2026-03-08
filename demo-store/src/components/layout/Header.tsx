"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ShoppingCart, Zap, Menu, X, LogOut, LogIn } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { useUserStore } from "@/stores/user-store";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500",
  seller: "bg-emerald-500",
  buyer: "bg-violet-500",
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const cartItemCount = useCartStore(
    (s) => s.items.reduce((sum, i) => sum + i.quantity, 0)
  );
  const { user, clearUser } = useUserStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  const navLinks = [
    { href: "/", label: "Store", roles: ["buyer", "admin", null] },
    { href: "/onboard", label: "Developers", roles: ["admin"] },
    { href: "/orders", label: "My Orders", roles: ["buyer", "admin"] },
    { href: "/seller", label: "Seller", roles: ["seller", "admin"] },
    { href: "/admin", label: "Admin", roles: ["admin"] },
    { href: "/faucet", label: "Faucet", roles: ["buyer", "seller", "admin"] },
  ];

  const visibleLinks = navLinks.filter((l) =>
    !supabaseConfigured || l.roles.includes(user?.role ?? null)
  );

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    clearUser();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-neutral-100 shrink-0"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="hidden sm:block">Demo Store</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {visibleLinks.map((link) => (
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
            {(!supabaseConfigured || !user || user.role !== "seller") && (
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
            )}

            {(!supabaseConfigured || !!user) && (
              <ConnectButton accountStatus="avatar" showBalance={false} />
            )}

            {supabaseConfigured && (
              <>
                {user ? (
                  <div className="hidden md:flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          ROLE_COLORS[user.role] ?? "bg-neutral-500"
                        )}
                      />
                      {user.email.split("@")[0]}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleLogout}
                      title="Sign out"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Link href="/auth/login" className="hidden md:block">
                    <Button variant="outline" size="sm">
                      <LogIn className="h-4 w-4" />
                      Sign In
                    </Button>
                  </Link>
                )}
              </>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-neutral-800 bg-neutral-950 px-4 py-3 space-y-1">
          {visibleLinks.map((link) => (
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
          {supabaseConfigured && (
            <div className="pt-2 border-t border-neutral-800 mt-2">
              {user ? (
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-400 hover:text-neutral-100"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out ({user.email.split("@")[0]})
                </button>
              ) : (
                <Link
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-400 hover:text-neutral-100"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
