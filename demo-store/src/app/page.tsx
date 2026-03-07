import { Zap, Shield, Truck, BarChart3 } from "lucide-react";
import { ProductGrid } from "@/components/products/ProductGrid";
import { MOCK_PRODUCTS } from "@/lib/mock-data";

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative border-b border-neutral-800 bg-gradient-to-b from-violet-950/20 to-neutral-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-800 bg-violet-950/50 px-4 py-1.5 text-sm text-violet-300 mb-6">
            <Zap className="h-3.5 w-3.5" />
            Powered by XRPL EVM Sidechain
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-neutral-100 mb-4">
            Shop with <span className="text-violet-400">Blockchain Escrow</span>
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto mb-8">
            Every purchase is protected by smart contracts. Sellers get paid incrementally as your order progresses — no disputes, no chargebacks.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-neutral-400">
            {[
              { icon: Shield, text: "Escrow-protected payments" },
              { icon: Truck, text: "Real-time payout tracking" },
              { icon: BarChart3, text: "On-chain audit trail" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-violet-400" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-neutral-100">Products</h2>
          <span className="text-sm text-neutral-500">{MOCK_PRODUCTS.length} items</span>
        </div>
        <ProductGrid products={MOCK_PRODUCTS} />
      </section>
    </div>
  );
}
