import Link from "next/link";
import { Zap, ShoppingBag, Store } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-neutral-100">Demo Store</span>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8">
          <h1 className="text-xl font-semibold text-neutral-100 mb-1">Create account</h1>
          <p className="text-sm text-neutral-400 mb-6">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-violet-400 hover:text-violet-300">
              Sign in
            </Link>
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/auth/buyer/signup"
              className="rounded-lg border border-neutral-700 hover:border-violet-600 p-4 text-left transition-colors group"
            >
              <ShoppingBag className="h-6 w-6 mb-2 text-neutral-500 group-hover:text-violet-400 transition-colors" />
              <p className="text-sm font-medium text-neutral-100">Sign up as Buyer</p>
              <p className="text-xs text-neutral-500 mt-0.5">Shop for products</p>
            </Link>
            <Link
              href="/auth/seller/signup"
              className="rounded-lg border border-neutral-700 hover:border-violet-600 p-4 text-left transition-colors group"
            >
              <Store className="h-6 w-6 mb-2 text-neutral-500 group-hover:text-violet-400 transition-colors" />
              <p className="text-sm font-medium text-neutral-100">Sign up as Seller</p>
              <p className="text-xs text-neutral-500 mt-0.5">Manage your store</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
