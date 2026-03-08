"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ExternalLink, Rocket, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OnboardingWizard, type OnboardingResult } from "@/lib/flowstate";
import { RequireRole } from "@/components/guards/RequireRole";

const FALLBACK_API_BASE_URL = "http://localhost:3001/api/v1";

function OnboardContent() {
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_FLOWSTATE_API_URL ?? FALLBACK_API_BASE_URL;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-6 rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-900 to-violet-950/30 p-6">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/15">
          <Zap className="h-5 w-5 text-violet-300" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-neutral-100 sm:text-3xl">
          Set up your platform on FlowState
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-400 sm:text-base">
          Create a project, get API credentials, and register webhooks so your
          marketplace can react to escrow and payout events.
        </p>
      </section>

      {!result ? (
        <OnboardingWizard apiBaseUrl={apiBaseUrl} onComplete={setResult} />
      ) : (
        <Card className="border-emerald-700/40 bg-emerald-950/20">
          <CardHeader>
            <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl text-emerald-200">
              Onboarding Complete
            </CardTitle>
            <CardDescription className="text-emerald-50/85">
              Your platform credentials are ready. Keep them secure before moving
              to integration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-neutral-400">Project ID:</span>{" "}
                <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs text-neutral-100">
                  {result.projectId}
                </code>
              </p>
              <p>
                <span className="text-neutral-400">API Key:</span>{" "}
                <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs text-neutral-100">
                  {result.apiKey}
                </code>
              </p>
              {result.webhookSecret && (
                <p>
                  <span className="text-neutral-400">Webhook Secret:</span>{" "}
                  <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs text-neutral-100">
                    {result.webhookSecret}
                  </code>
                </p>
              )}
            </div>

            <Separator />

            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-300">
                <Rocket className="h-4 w-4 text-violet-400" />
                Next Steps
              </h2>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <a
                    href="https://docs.flowstate.xyz"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Docs
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/">Open Demo Store</Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResult(null)}
                >
                  Create Another Project
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function OnboardPage() {
  return (
    <RequireRole roles={["admin"]}>
      <OnboardContent />
    </RequireRole>
  );
}
