# Plan: Platform Onboarding Web UI

## Context

The FlowState gateway backend (`backend/`) has a `POST /api/v1/auth/projects/create` endpoint that creates a new platform project and returns a `project_id` (`fs_proj_*`) + `api_key` (`fs_live_key_*`). Currently this is API-only — no web UI exists. The architecture doc (WORKFLOW 1, lines 336-508) describes a developer onboarding flow where developers create a project, receive credentials, configure platform fees, and register webhooks. We need to build this UI as part of the gateway so any platform can import and use it.

**Backend endpoints involved:**
- `POST /api/v1/auth/projects/create` (no auth) — `backend/src/routes/auth.routes.ts` — accepts `{ name, owner_email, platform_fee_wallet, platform_fee_bps?, contracts? }`, returns `{ project_id, api_key }`
- `POST /api/v1/webhooks/register` (auth required) — `backend/src/routes/webhooks.routes.ts` — accepts `{ url, events?, secret? }`, returns `{ registration_id, secret, url, events }`
- `POST /api/v1/auth/api-keys/rotate` (auth required) — `backend/src/routes/auth.routes.ts`

**DB types:** `backend/src/db/types.ts` — `Project`, `ApiKey`, `WebhookRegistration`
**ID generation:** `backend/src/utils/id-generator.ts` — `fs_proj_*`, `fs_live_key_*`, `fs_key_*`, `fs_whr_*`

## Files to Create

### 1. `demo-store/src/lib/flowstate/client/OnboardingWizard.tsx` (NEW)

Multi-step onboarding form component. Lives in the gateway SDK directory so platforms can import it directly.

**Props:**
```typescript
interface OnboardingWizardProps {
  apiBaseUrl: string;                          // e.g. "http://localhost:3001/api/v1"
  onComplete?: (result: OnboardingResult) => void;
  className?: string;
}
interface OnboardingResult {
  projectId: string;
  apiKey: string;
  webhookSecret?: string;
}
```

**3-step wizard:**

| Step | Title | Fields | API Call | Output |
|------|-------|--------|----------|--------|
| 1 | Project Details | name, owner_email, platform_fee_wallet, platform_fee_bps (default 250) | `POST /auth/projects/create` | Stores `project_id` + `api_key` in state |
| 2 | Your Credentials | Read-only display of project_id + api_key with copy buttons, code snippet showing `<FlowStateProvider>` usage | None | User saves credentials |
| 3 | Webhook Setup (optional) | webhook URL, event type checkboxes | `POST /webhooks/register` (Bearer token from step 1) | Shows webhook secret |

**UI details:**
- Step indicator bar at top: 3 numbered circles with connecting lines (reuse similar pattern to `EscrowProgressBar`)
- Dark theme: neutral-950 bg, violet accents, matching existing demo-store
- shadcn/ui components: `Card`, `Input`, `Label`, `Button`, `Separator` from `@/components/ui/`
- Icons from lucide-react: `Rocket`, `Key`, `Webhook`, `Copy`, `Check`, `Loader2`, `AlertTriangle`, `ChevronRight`
- Copy buttons: click → copies to clipboard → shows checkmark for 2s
- API key warning: "Save this key — it will only be shown once"
- Step 2 has "Continue to Webhook Setup" + "Skip & Finish" buttons
- Error handling: inline validation + API error banner
- Responsive: single-column form, works on mobile

**Event types for webhook checkboxes:**
- `escrow.created` — When escrow deposit is confirmed
- `state.advanced` — When order moves to next state
- `order.finalized` — When order is complete
- `dispute.created` — When a dispute is filed
- `payout.released` — When a payout is released to seller

### 2. `demo-store/src/app/onboard/page.tsx` (NEW)

Page that hosts the `OnboardingWizard`.

- No `RequireRole` — accessible to anyone (developer onboarding is unauthenticated)
- Reads `NEXT_PUBLIC_FLOWSTATE_API_URL` env var (fallback: `http://localhost:3001/api/v1`)
- Header: FlowState logo/icon + "Set up your platform on FlowState" + brief description
- `onComplete` callback: shows a final success card with links to docs / next steps

## Files to Modify

### 3. `demo-store/src/lib/flowstate/index.ts`
Add export line:
```typescript
export { OnboardingWizard } from "./client/OnboardingWizard";
```

### 4. `demo-store/src/components/layout/Header.tsx`
Add entry to the `navLinks` array:
```typescript
{ href: "/onboard", label: "Developers", roles: ["buyer", "seller", "admin", null] },
```
This makes the onboarding page accessible from the global nav for all users (including unauthenticated).

## Implementation Sequence

1. Create `OnboardingWizard.tsx` — the core 3-step wizard
2. Create `/onboard/page.tsx` — the demo-store page
3. Export from `lib/flowstate/index.ts`
4. Add nav link if applicable

## Verification

1. Navigate to `/onboard` — wizard loads at Step 1
2. Fill project details → submit → API call succeeds → Step 2 shows credentials
3. Copy buttons work (project_id, api_key)
4. Code snippet shows correct `<FlowStateProvider>` config with the returned values
5. "Continue to Webhook Setup" → Step 3 form with URL input + event checkboxes
6. Fill webhook URL → submit → API call with Bearer token succeeds → webhook secret shown
7. "Finish" → `onComplete` fires with `{ projectId, apiKey, webhookSecret }`
8. Test "Skip & Finish" from Step 2 → skips webhook, fires `onComplete` without webhook secret
9. Validation: empty name, invalid email, empty wallet → inline errors, no API call
10. Backend not running → graceful error message on API failure
11. Mobile responsive — form usable on small screens
