# FlowState

FlowState is a blockchain escrow checkout platform composed of a hosted-style backend, XRPL EVM contracts, and a demo storefront that mirrors the future `@flowstate/gateway` package.

## Start Here

- Developer docs source: [`docs-site/app/page.mdx`](docs-site/app/page.mdx)
- 5 minute setup: [`docs-site/app/quickstart/page.mdx`](docs-site/app/quickstart/page.mdx)
- Integration guide: [`docs-site/app/integration/install/page.mdx`](docs-site/app/integration/install/page.mdx)
- Local development: [`docs-site/app/self-hosting/local-dev/page.mdx`](docs-site/app/self-hosting/local-dev/page.mdx)
- API reference: [`docs-site/app/reference/api-endpoints/page.mdx`](docs-site/app/reference/api-endpoints/page.mdx)
- Architecture background: [`docs/project-breakdown.md`](docs/project-breakdown.md)

## Repository Layout

- `backend/` - Fastify API, PostgreSQL access, queues, cron, and WebSocket event delivery
- `demo-store/` - Next.js storefront and local mirror of the future gateway package
- `packages/contracts/` - Hardhat project for FLUSD, escrow, and dispute contracts
- `docs/` - Architecture notes and older background material
- `docs-site/` - Nextra-powered documentation site
- `docs-site/app/` - Canonical docs source in file-based MDX routes

## Current Status

- The backend is implemented and talks directly to Postgres with the `postgres` client.
- Shippo integration is live in the backend.
- Pinata and blockchain bridges in the backend are stubbed today.
- The demo store can run with mock data even if Supabase and contracts are not configured.
- Smart contracts are real and tested under `packages/contracts/`.

## Running The Docs Site

```bash
cd docs-site
npm install
npm run dev
```

Open `http://localhost:3000`.
