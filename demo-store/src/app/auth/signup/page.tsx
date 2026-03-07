"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Zap, ShoppingBag, Store } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/flowstate/types";

export default function SignUpPage() {
  const router = useRouter();

  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: role as UserRole },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(role === "seller" ? "/seller/signup" : "/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-neutral-100">FlowState</span>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8">
          <h1 className="text-xl font-semibold text-neutral-100 mb-1">
            Create account
          </h1>
          <p className="text-sm text-neutral-400 mb-6">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-violet-400 hover:text-violet-300"
            >
              Sign in
            </Link>
          </p>

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {(
              [
                {
                  value: "buyer",
                  label: "Buyer",
                  desc: "Shop for products",
                  icon: ShoppingBag,
                },
                {
                  value: "seller",
                  label: "Seller",
                  desc: "Sell your products",
                  icon: Store,
                },
              ] as const
            ).map(({ value, label, desc, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  role === value
                    ? "border-violet-600 bg-violet-950/40"
                    : "border-neutral-700 hover:border-neutral-600"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 mb-1.5",
                    role === value ? "text-violet-400" : "text-neutral-500"
                  )}
                />
                <p
                  className={cn(
                    "text-sm font-medium",
                    role === value ? "text-neutral-100" : "text-neutral-400"
                  )}
                >
                  {label}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-neutral-300"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
