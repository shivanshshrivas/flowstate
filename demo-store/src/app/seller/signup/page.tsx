"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function SellerSignupPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    business_name: "",
    email: "",
    address1: "",
    city: "",
    state: "",
    zip: "",
    immediate_bps: 3000,
    milestone_bps: 5500,
    holdback_bps: 1500,
  });

  const payoutTotal =
    formData.immediate_bps + formData.milestone_bps + formData.holdback_bps;
  const payoutValid = payoutTotal === 10000;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payoutValid || !address) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: formData.business_name,
          email: formData.email,
          wallet_address: address,
          address: {
            name: formData.business_name,
            address1: formData.address1,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
            country: "US",
          },
          payout_config: {
            immediate_bps: formData.immediate_bps,
            milestone_bps: formData.milestone_bps,
            holdback_bps: formData.holdback_bps,
          },
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to create seller profile");
      }

      setSuccess(true);
      setTimeout(() => router.push("/seller"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create seller profile");
    } finally {
      setIsSubmitting(false);
    }
  }

  function field(key: keyof typeof formData) {
    return {
      value: formData[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setFormData((current) => ({
          ...current,
          [key]: key.endsWith("_bps") ? Number(e.target.value) : e.target.value,
        })),
    };
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-neutral-100">Welcome aboard!</h2>
        <p className="text-neutral-400 mt-2">
          Your seller account has been created. Redirecting...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/20 border border-violet-600/30 mb-4">
          <Store className="h-6 w-6 text-violet-400" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-100">Become a Seller</h1>
        <p className="text-neutral-400 mt-1">
          Start selling on FlowState and get paid securely via blockchain escrow.
        </p>
      </div>

      {!isConnected ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-neutral-400 mb-4">Connect your wallet to get started.</p>
            <ConnectButton />
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Business Name</Label>
                <Input className="mt-1" placeholder="Acme Co." required {...field("business_name")} />
              </div>
              <div>
                <Label>Email</Label>
                <Input className="mt-1" type="email" placeholder="hello@acme.co" required {...field("email")} />
              </div>
              <div>
                <Label>Wallet Address</Label>
                <Input className="mt-1 opacity-70 cursor-not-allowed" value={address ?? ""} readOnly />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ship-from Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Street Address</Label>
                <Input className="mt-1" placeholder="123 Warehouse Blvd" required {...field("address1")} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>City</Label>
                  <Input className="mt-1" placeholder="San Francisco" required {...field("city")} />
                </div>
                <div>
                  <Label>State</Label>
                  <Input className="mt-1" placeholder="CA" required {...field("state")} />
                </div>
                <div>
                  <Label>ZIP</Label>
                  <Input className="mt-1" placeholder="94102" required {...field("zip")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payout Configuration</CardTitle>
              <CardDescription>
                Configure how your escrow payouts are split across order milestones. Must sum to
                100%.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  key: "immediate_bps" as const,
                  label: "Immediate (Label Printed)",
                  desc: "Released when you print the shipping label",
                },
                {
                  key: "milestone_bps" as const,
                  label: "Milestone (Shipped -> Delivered)",
                  desc: "Released incrementally through shipping states",
                },
                {
                  key: "holdback_bps" as const,
                  label: "Holdback (Finalized)",
                  desc: "Released after 7-day grace period post-delivery",
                },
              ].map(({ key, label, desc }) => (
                <div key={key}>
                  <div className="flex justify-between mb-1">
                    <Label>{label}</Label>
                    <span className="text-sm font-semibold text-violet-400">
                      {(formData[key] / 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mb-2">{desc}</p>
                  <Input type="number" min="0" max="10000" step="100" {...field(key)} />
                </div>
              ))}
              <Separator />
              <div
                className={`flex justify-between text-sm font-semibold ${
                  payoutValid ? "text-emerald-400" : "text-red-400"
                }`}
              >
                <span>Total</span>
                <span>
                  {(payoutTotal / 100).toFixed(0)}% {payoutValid ? "OK" : "(must equal 100%)"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !payoutValid}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating Account...
              </>
            ) : (
              "Create Seller Account"
            )}
          </Button>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
