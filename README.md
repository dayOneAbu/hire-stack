# HireStack

Verified, structured hiring platform for overseas VA recruiting in real estate. See `docs/` for
the full product spec — `PRD.md` (problem, product decisions, tech stack rationale),
`FUNCTIONAL_REQUIREMENTS.md` (mechanics), `NON_FUNCTIONAL_REQUIREMENTS.md`, and `schema.prisma`
(design reference — the working schema lives in `prisma/schema.prisma`).

## Stack

Next.js (App Router) · tRPC · PostgreSQL + Prisma · BetterAuth · OpenAI-compatible AI (NVIDIA NIM
free tier) · Stripe · Cloudflare R2. Full rationale in `docs/PRD.md` §8 — every service below runs
on a free tier through MVP/build phase.

## Local setup

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Database — [Neon](https://neon.tech) (free tier)**
   Create a project, copy the pooled connection string into `.env` as `DATABASE_URL`.

3. **Auth — [BetterAuth](https://better-auth.com)**
   Generate a secret: `openssl rand -base64 32` → `BETTER_AUTH_SECRET` in `.env`.

4. **AI extraction — [NVIDIA NIM](https://build.nvidia.com) (free tier)**
   Sign up, grab an API key from any model page (e.g. DeepSeek-V3 or GLM) → `AI_API_KEY`.
   No code change needed to switch models/providers later — see `lib/ai.ts`.

5. **File storage — [Cloudflare R2](https://developers.cloudflare.com/r2/) (free tier)**
   Create a bucket, an API token with R2 read/write, fill in `R2_*` vars.

6. **Billing — [Stripe](https://dashboard.stripe.com) (test mode)**
   `STRIPE_SECRET_KEY` from the dashboard; `STRIPE_WEBHOOK_SECRET` from `stripe listen` locally.

7. **Copy env and fill in the values above**
   ```bash
   cp .env.example .env
   ```

8. **Push the schema and generate the client**
   ```bash
   pnpm db:migrate
   ```

9. **Run**
   ```bash
   pnpm dev
   ```

## Deployment

Hosted on [Render](https://render.com) (free tier) — not Vercel, whose Hobby tier prohibits
commercial/revenue-generating use. Render's free tier spins down after 15 minutes idle; a free
[UptimeRobot](https://uptimerobot.com) monitor pings `/api/health` every 5 minutes to keep the
instance warm. See `docs/PRD.md` §8 for the full trade-off writeup and the paid-tier fallback for
high-stakes live demos.

## Project structure

```
app/
  (marketing)/     public site
  (candidate)/     onboarding wizard, dashboard
  (employer)/      search, job posts, Kanban board
  (admin)/         software approval queue, employment review queue, user lookup
  api/
    auth/[...all]  BetterAuth handler
    trpc/[trpc]    tRPC handler
    webhooks/stripe
    health         UptimeRobot ping target
lib/               service clients (prisma, auth, ai, storage, stripe) — one file per integration
server/trpc/       tRPC context, middleware/procedures, routers
prisma/            working schema (source of truth for migrations)
docs/              product spec — read this before changing business logic
```
