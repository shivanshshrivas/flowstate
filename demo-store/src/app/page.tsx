import { ShoppingBag, Truck, RotateCcw } from "lucide-react";
import { ProductGrid } from "@/components/products/ProductGrid";
import { MOCK_PRODUCTS } from "@/lib/mock-data";

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="border-b border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-neutral-100 mb-4">
            Shop{" "}
            <span className="text-violet-400">Everything</span>
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto mb-8">
            Curated products from trusted sellers. Secure checkout, fast
            delivery, and easy returns on every order.
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-sm text-neutral-400">
            {[
              { icon: ShoppingBag, text: "Curated Products" },
              { icon: Truck, text: "Fast Shipping" },
              { icon: RotateCcw, text: "Easy Returns" },
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
          <span className="text-sm text-neutral-500">
            {MOCK_PRODUCTS.length} items
          </span>
        </div>
        <ProductGrid products={MOCK_PRODUCTS} />
      </section>
    </div>
  );
}
