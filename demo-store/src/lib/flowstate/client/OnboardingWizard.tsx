"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Key,
  Loader2,
  Rocket,
  Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiFailure {
  success: false;
  error?: {
    code?: string;
    message?: string;
  };
}

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

interface CreateProjectResponse {
  project_id: string;
  api_key: string;
}

interface RegisterWebhookResponse {
  registration_id: string;
  secret: string;
  url: string;
  events: string[];
}

type WizardStep = 1 | 2 | 3;
type CopyTarget = "project_id" | "api_key" | "webhook_secret";

const WIZARD_STEPS = [
  { id: 1 as const, title: "Project Details", icon: Rocket },
  { id: 2 as const, title: "Your Credentials", icon: Key },
  { id: 3 as const, title: "Webhook Setup", icon: Webhook },
];

const WEBHOOK_EVENT_OPTIONS = [
  {
    event: "escrow.created",
    description: "When escrow deposit is confirmed",
  },
  {
    event: "state.advanced",
    description: "When order moves to next state",
  },
  {
    event: "order.finalized",
    description: "When order is complete",
  },
  {
    event: "dispute.created",
    description: "When a dispute is filed",
  },
  {
    event: "payout.released",
    description: "When a payout is released to seller",
  },
] as const;

interface ProjectFormState {
  name: string;
  owner_email: string;
  platform_fee_wallet: string;
  platform_fee_bps: string;
}

interface WebhookFormState {
  url: string;
  events: string[];
}

interface ProjectFormErrors {
  name?: string;
  owner_email?: string;
  platform_fee_wallet?: string;
  platform_fee_bps?: string;
}

interface WebhookFormErrors {
  url?: string;
  events?: string;
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  const trimmed = apiBaseUrl.trim();
  if (!trimmed) return "http://localhost:3001/api/v1";
  return trimmed.replace(/\/+$/, "");
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getApiErrorMessage(payload: ApiResponse<unknown> | null, status: number): string {
  if (payload && !payload.success && payload.error?.message) {
    return payload.error.message;
  }
  return `Request failed with status ${status}`;
}

export interface OnboardingWizardProps {
  apiBaseUrl: string;
  onComplete?: (result: OnboardingResult) => void;
  className?: string;
}

export interface OnboardingResult {
  projectId: string;
  apiKey: string;
  webhookSecret?: string;
}

export function OnboardingWizard({
  apiBaseUrl,
  onComplete,
  className,
}: OnboardingWizardProps) {
  const normalizedApiBaseUrl = useMemo(
    () => normalizeApiBaseUrl(apiBaseUrl),
    [apiBaseUrl]
  );

  const [step, setStep] = useState<WizardStep>(1);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [copiedField, setCopiedField] = useState<CopyTarget | null>(null);
  const [localCompleteResult, setLocalCompleteResult] =
    useState<OnboardingResult | null>(null);

  const [projectId, setProjectId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState<string | undefined>(
    undefined
  );

  const [projectForm, setProjectForm] = useState<ProjectFormState>({
    name: "",
    owner_email: "",
    platform_fee_wallet: "",
    platform_fee_bps: "250",
  });
  const [projectErrors, setProjectErrors] = useState<ProjectFormErrors>({});

  const [webhookForm, setWebhookForm] = useState<WebhookFormState>({
    url: "",
    events: WEBHOOK_EVENT_OPTIONS.map((option) => option.event),
  });
  const [webhookErrors, setWebhookErrors] = useState<WebhookFormErrors>({});

  const providerSnippet = useMemo(() => {
    const snippetProjectId = projectId || "fs_proj_abc123";
    const snippetApiKey = apiKey || "fs_live_key_xyz";

    return `import { FlowStateProvider } from "@flowstate/gateway";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FlowStateProvider
      projectId="${snippetProjectId}"
      apiKey="${snippetApiKey}"
      network="testnet"
    >
      {children}
    </FlowStateProvider>
  );
}`;
  }, [projectId, apiKey]);

  function validateProjectForm(): boolean {
    const nextErrors: ProjectFormErrors = {};
    const parsedFeeBps = Number(projectForm.platform_fee_bps);

    if (!projectForm.name.trim()) {
      nextErrors.name = "Project name is required.";
    }

    if (!projectForm.owner_email.trim()) {
      nextErrors.owner_email = "Owner email is required.";
    } else if (!isValidEmail(projectForm.owner_email)) {
      nextErrors.owner_email = "Enter a valid email address.";
    }

    if (!projectForm.platform_fee_wallet.trim()) {
      nextErrors.platform_fee_wallet = "Platform fee wallet is required.";
    }

    if (!Number.isInteger(parsedFeeBps) || parsedFeeBps < 0 || parsedFeeBps > 10000) {
      nextErrors.platform_fee_bps = "Platform fee must be an integer between 0 and 10000 bps.";
    }

    setProjectErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateWebhookForm(): boolean {
    const nextErrors: WebhookFormErrors = {};

    if (!webhookForm.url.trim()) {
      nextErrors.url = "Webhook URL is required.";
    } else if (!isValidUrl(webhookForm.url)) {
      nextErrors.url = "Enter a valid HTTP or HTTPS URL.";
    }

    if (webhookForm.events.length === 0) {
      nextErrors.events = "Select at least one event.";
    }

    setWebhookErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function finishOnboarding(secret?: string) {
    if (!projectId || !apiKey) return;

    const result: OnboardingResult = {
      projectId,
      apiKey,
      webhookSecret: secret,
    };

    onComplete?.(result);

    if (!onComplete) {
      setLocalCompleteResult(result);
    }
  }

  async function handleCopy(target: CopyTarget, value: string) {
    if (!value) return;

    setApiError(null);

    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API is not available in this browser.");
      }

      await navigator.clipboard.writeText(value);
      setCopiedField(target);
      window.setTimeout(() => {
        setCopiedField((current) => (current === target ? null : current));
      }, 2000);
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "Could not copy value to clipboard."
      );
    }
  }

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiError(null);

    if (!validateProjectForm()) return;

    setIsCreatingProject(true);

    try {
      const response = await fetch(`${normalizedApiBaseUrl}/auth/projects/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectForm.name.trim(),
          owner_email: projectForm.owner_email.trim(),
          platform_fee_wallet: projectForm.platform_fee_wallet.trim(),
          platform_fee_bps: Number(projectForm.platform_fee_bps),
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as ApiResponse<CreateProjectResponse> | null;

      if (!response.ok || !payload?.success) {
        throw new Error(getApiErrorMessage(payload, response.status));
      }

      const nextProjectId = payload.data.project_id;
      const nextApiKey = payload.data.api_key;

      if (!nextProjectId || !nextApiKey) {
        throw new Error("Project was created but credentials were missing.");
      }

      setProjectId(nextProjectId);
      setApiKey(nextApiKey);
      setStep(2);
      setWebhookSecret(undefined);
      setApiError(null);
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "Could not create project. Please try again."
      );
    } finally {
      setIsCreatingProject(false);
    }
  }

  async function handleRegisterWebhook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiError(null);

    if (!projectId || !apiKey) {
      setApiError("Create a project before registering webhooks.");
      return;
    }

    if (!validateWebhookForm()) return;

    setIsRegisteringWebhook(true);

    try {
      const response = await fetch(`${normalizedApiBaseUrl}/webhooks/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: webhookForm.url.trim(),
          events: webhookForm.events,
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as ApiResponse<RegisterWebhookResponse> | null;

      if (!response.ok || !payload?.success) {
        throw new Error(getApiErrorMessage(payload, response.status));
      }

      if (!payload.data.secret) {
        throw new Error("Webhook created but secret was missing.");
      }

      setWebhookSecret(payload.data.secret);
      setApiError(null);
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "Could not register webhook. Please try again."
      );
    } finally {
      setIsRegisteringWebhook(false);
    }
  }

  function toggleWebhookEvent(eventName: string) {
    setWebhookErrors((prev) => ({ ...prev, events: undefined }));
    setWebhookForm((prev) => {
      const exists = prev.events.includes(eventName);
      return {
        ...prev,
        events: exists
          ? prev.events.filter((event) => event !== eventName)
          : [...prev.events, eventName],
      };
    });
  }

  if (localCompleteResult) {
    return (
      <Card className={cn("border-emerald-700/40 bg-emerald-950/20", className)}>
        <CardHeader>
          <CardTitle className="text-emerald-300">Onboarding Complete</CardTitle>
          <CardDescription className="text-emerald-100/80">
            Your FlowState project is ready to use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-neutral-200">
          <p>
            <span className="text-neutral-400">Project ID:</span>{" "}
            <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs">
              {localCompleteResult.projectId}
            </code>
          </p>
          <p>
            <span className="text-neutral-400">API Key:</span>{" "}
            <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs">
              {localCompleteResult.apiKey}
            </code>
          </p>
          {localCompleteResult.webhookSecret && (
            <p>
              <span className="text-neutral-400">Webhook Secret:</span>{" "}
              <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs">
                {localCompleteResult.webhookSecret}
              </code>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-neutral-800 bg-neutral-900", className)}>
      <CardHeader className="space-y-5">
        <div>
          <CardTitle className="text-xl text-neutral-100">
            Platform Onboarding Wizard
          </CardTitle>
          <CardDescription className="mt-1">
            Create your project, save credentials, and optionally register webhooks.
          </CardDescription>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
          <div className="flex items-start gap-2">
            {WIZARD_STEPS.map((wizardStep, index) => {
              const Icon = wizardStep.icon;
              const isCompleted = step > wizardStep.id;
              const isCurrent = step === wizardStep.id;

              return (
                <div key={wizardStep.id} className="flex flex-1 items-center">
                  <div className="min-w-0 text-center">
                    <div
                      className={cn(
                        "mx-auto flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                        isCompleted
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : isCurrent
                          ? "border-violet-500 bg-violet-500 text-white"
                          : "border-neutral-700 bg-neutral-900 text-neutral-500"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <p
                      className={cn(
                        "mt-2 text-[11px] font-medium leading-tight sm:text-xs",
                        isCompleted
                          ? "text-emerald-300"
                          : isCurrent
                          ? "text-violet-300"
                          : "text-neutral-500"
                      )}
                    >
                      {wizardStep.title}
                    </p>
                  </div>

                  {index < WIZARD_STEPS.length - 1 && (
                    <div
                      className={cn(
                        "mx-2 mb-5 h-0.5 flex-1 rounded-full",
                        isCompleted ? "bg-emerald-500" : "bg-neutral-800"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {apiError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{apiError}</p>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div className="flex items-center gap-2 text-neutral-200">
              <Rocket className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
                Step 1: Project Details
              </h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboard-project-name">Project Name</Label>
              <Input
                id="onboard-project-name"
                value={projectForm.name}
                onChange={(event) => {
                  setApiError(null);
                  setProjectErrors((prev) => ({ ...prev, name: undefined }));
                  setProjectForm((prev) => ({ ...prev, name: event.target.value }));
                }}
                placeholder="MyShop"
                required
              />
              {projectErrors.name && (
                <p className="text-xs text-red-400">{projectErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboard-owner-email">Owner Email</Label>
              <Input
                id="onboard-owner-email"
                type="email"
                value={projectForm.owner_email}
                onChange={(event) => {
                  setApiError(null);
                  setProjectErrors((prev) => ({ ...prev, owner_email: undefined }));
                  setProjectForm((prev) => ({
                    ...prev,
                    owner_email: event.target.value,
                  }));
                }}
                placeholder="owner@myshop.com"
                required
              />
              {projectErrors.owner_email && (
                <p className="text-xs text-red-400">{projectErrors.owner_email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboard-platform-wallet">Platform Fee Wallet</Label>
              <Input
                id="onboard-platform-wallet"
                value={projectForm.platform_fee_wallet}
                onChange={(event) => {
                  setApiError(null);
                  setProjectErrors((prev) => ({
                    ...prev,
                    platform_fee_wallet: undefined,
                  }));
                  setProjectForm((prev) => ({
                    ...prev,
                    platform_fee_wallet: event.target.value,
                  }));
                }}
                placeholder="0xPlatformWallet..."
                required
              />
              {projectErrors.platform_fee_wallet && (
                <p className="text-xs text-red-400">
                  {projectErrors.platform_fee_wallet}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboard-platform-fee-bps">Platform Fee (BPS)</Label>
              <Input
                id="onboard-platform-fee-bps"
                type="number"
                min={0}
                max={10000}
                value={projectForm.platform_fee_bps}
                onChange={(event) => {
                  setApiError(null);
                  setProjectErrors((prev) => ({
                    ...prev,
                    platform_fee_bps: undefined,
                  }));
                  setProjectForm((prev) => ({
                    ...prev,
                    platform_fee_bps: event.target.value,
                  }));
                }}
                required
              />
              <p className="text-xs text-neutral-500">Default is 250 bps (2.5%).</p>
              {projectErrors.platform_fee_bps && (
                <p className="text-xs text-red-400">{projectErrors.platform_fee_bps}</p>
              )}
            </div>

            <Button type="submit" className="w-full sm:w-auto" disabled={isCreatingProject}>
              {isCreatingProject ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Project...
                </>
              ) : (
                <>
                  Create Project
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-neutral-200">
              <Key className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
                Step 2: Your Credentials
              </h3>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Project ID</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-neutral-900 px-2 py-1 text-xs text-neutral-100">
                    {projectId}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy("project_id", projectId)}
                  >
                    {copiedField === "project_id" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copiedField === "project_id" ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">API Key</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-neutral-900 px-2 py-1 text-xs text-neutral-100">
                    {apiKey}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy("api_key", apiKey)}
                  >
                    {copiedField === "api_key" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copiedField === "api_key" ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-800/70 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Save this key - it will only be shown once.</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-300">
                Add this to your app:
              </p>
              <pre className="max-h-72 overflow-auto rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-200">
                <code>{providerSnippet}</code>
              </pre>
            </div>

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setApiError(null);
                  setStep(1);
                }}
              >
                Back
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => finishOnboarding()}>
                  Skip & Finish
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setApiError(null);
                    setStep(3);
                  }}
                >
                  Continue to Webhook Setup
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-neutral-200">
              <Webhook className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
                Step 3: Webhook Setup (Optional)
              </h3>
            </div>

            {!webhookSecret ? (
              <form onSubmit={handleRegisterWebhook} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="onboard-webhook-url">Webhook URL</Label>
                  <Input
                    id="onboard-webhook-url"
                    type="url"
                    value={webhookForm.url}
                    onChange={(event) => {
                      setApiError(null);
                      setWebhookErrors((prev) => ({ ...prev, url: undefined }));
                      setWebhookForm((prev) => ({ ...prev, url: event.target.value }));
                    }}
                    placeholder="https://myshop.com/api/webhooks/flowstate"
                    required
                  />
                  {webhookErrors.url && (
                    <p className="text-xs text-red-400">{webhookErrors.url}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Event Types</Label>
                  <div className="space-y-2">
                    {WEBHOOK_EVENT_OPTIONS.map((option) => {
                      const checked = webhookForm.events.includes(option.event);
                      return (
                        <label
                          key={option.event}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 hover:border-neutral-700"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleWebhookEvent(option.event)}
                            className="mt-1 h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-violet-500 focus:ring-violet-500"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-neutral-200">
                              {option.event}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {option.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {webhookErrors.events && (
                    <p className="text-xs text-red-400">{webhookErrors.events}</p>
                  )}
                </div>

                <Separator />

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setApiError(null);
                      setStep(2);
                    }}
                  >
                    Back
                  </Button>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => finishOnboarding()}
                    >
                      Skip & Finish
                    </Button>
                    <Button type="submit" disabled={isRegisteringWebhook}>
                      {isRegisteringWebhook ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Registering...
                        </>
                      ) : (
                        "Register Webhook"
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/20 p-3">
                  <p className="text-sm font-medium text-emerald-300">
                    Webhook registration complete
                  </p>
                  <p className="mt-1 text-xs text-emerald-100/80">
                    Keep this secret safe. It is used to verify webhook signatures.
                  </p>
                </div>

                <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    Webhook Secret
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-neutral-900 px-2 py-1 text-xs text-neutral-100">
                      {webhookSecret}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy("webhook_secret", webhookSecret)}
                    >
                      {copiedField === "webhook_secret" ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedField === "webhook_secret" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setApiError(null);
                      setWebhookSecret(undefined);
                    }}
                  >
                    Register Different Webhook
                  </Button>
                  <Button type="button" onClick={() => finishOnboarding(webhookSecret)}>
                    Finish
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

