import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Package, Shield, Truck, Clock } from "lucide-react";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
import { formatUsd } from "@/lib/utils";
import { BuyerPayButton } from "@/components/products/BuyerPayButton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;
  const product = MOCK_PRODUCTS.find((p) => p.id === id);

  if (!product) notFound();

  const seller = { name: product.seller_name ?? "Unknown Seller" };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Store
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Image */}
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-neutral-800">
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Details */}
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary">{product.category}</Badge>
              <span className="text-sm text-neutral-500">Sold by {seller.name}</span>
            </div>
            <h1 className="text-3xl font-bold text-neutral-100">{product.name}</h1>
            <p className="text-3xl font-bold text-violet-400 mt-3">
              {formatUsd(product.price_usd)}
            </p>
            <p className="text-sm text-neutral-400 mt-1">+ shipping · MockRLUSD (FLUSD) via escrow</p>
          </div>

          <p className="text-neutral-300 leading-relaxed">{product.description}</p>

          {/* Specs */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-neutral-800 rounded-lg p-3">
              <p className="text-neutral-500 text-xs mb-0.5">Weight</p>
              <p className="text-neutral-100 font-medium">{product.weight_oz} oz</p>
            </div>
            <div className="bg-neutral-800 rounded-lg p-3">
              <p className="text-neutral-500 text-xs mb-0.5">Dimensions</p>
              <p className="text-neutral-100 font-medium">
                {product.dimensions.length}×{product.dimensions.width}×{product.dimensions.height} in
              </p>
            </div>
            <div className="bg-neutral-800 rounded-lg p-3">
              <p className="text-neutral-500 text-xs mb-0.5">In Stock</p>
              <p className="text-neutral-100 font-medium">{product.stock} units</p>
            </div>
            <div className="bg-neutral-800 rounded-lg p-3">
              <p className="text-neutral-500 text-xs mb-0.5">Category</p>
              <p className="text-neutral-100 font-medium">{product.category}</p>
            </div>
          </div>

          <Separator />

          {/* Escrow explanation */}
          <div className="rounded-xl border border-violet-800/50 bg-violet-950/20 p-4 space-y-3">
            <p className="text-sm font-semibold text-violet-300 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              FlowState Escrow Protection
            </p>
            <div className="grid gap-2 text-xs text-neutral-400">
              {[
                { icon: Shield, text: "Payment held in smart contract until delivery" },
                { icon: Truck, text: "Seller gets paid in increments as order progresses" },
                { icon: Clock, text: "7-day grace period after delivery before final release" },
                { icon: Package, text: "On-chain audit trail for every state transition" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                  {text}
                </div>
              ))}
            </div>
          </div>

          <BuyerPayButton product={product} className="w-full" />
        </div>
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return MOCK_PRODUCTS.map((p) => ({ id: p.id }));
}
