@AGENTS.md

# HireStack

Verified, structured hiring platform for overseas VA recruiting in real estate. Full product
spec lives in `docs/` — **read it before changing business logic**, not just the code:

- `docs/PRD.md` — problem statement, product bet, non-goals, key product decisions, tech stack
  rationale (§8). Every stack/infra choice here is deliberate and justified — don't substitute
  a piece (e.g. swap Prisma for Drizzle, or NVIDIA NIM for OpenAI) without re-reading why it was
  picked.
- `docs/FUNCTIONAL_REQUIREMENTS.md` — the actual mechanics: wizard state machine, publish gate,
  admin queues, billing/slot logic, match score formula, search/Kanban rules, parsing failure
  modes. This is the source of truth for "what should this do," not the schema comments.
- `docs/NON_FUNCTIONAL_REQUIREMENTS.md` — performance targets, file limits, data retention.
- `docs/schema.prisma` — the **design reference** the FRS was written against. The actual
  working schema is `prisma/schema.prisma` — it matches `docs/schema.prisma` plus BetterAuth's
  required tables merged in. If the two ever diverge, `prisma/schema.prisma` (the real one) wins,
  but check whether the FRS needs a corresponding update rather than assuming the docs are stale.

## Load-bearing decisions (do not relitigate without flagging it)

- **Publish gate is derived, not toggled**: `Candidate.isSearchable` becomes true only when zero
  `EmploymentAnomaly` rows remain in `PENDING_CANDIDATE` or `FLAGGED_FOR_ADMIN_REVIEW`. No
  separate "admin approves candidate" action exists — don't add one.
  See FRS §4.3.
- **Ambiguity detection is a deterministic rule pass, not an LLM judgment call.** The AI's only
  job is structured extraction. See FRS §3.
- **Match score is per-`(candidateId, jobPostId)`, never profile-level**, and never
  auto-adds a candidate to a Kanban board. See FRS §10 for the weighted formula.
- **Kanban stage transitions are fully free-form** — no workflow enforcement, any direction,
  including out of `REJECTED`. Don't add a state machine here.
- **Job slot checks happen only at `DRAFT → ACTIVE`**, computed live via a count query, never a
  stored counter. See FRS §8.
- Full list of these calls: PRD §7.

## Stack (all free-tier through MVP — see PRD §8 for the full rationale on each)

Next.js (App Router) · tRPC · PostgreSQL (Neon) + Prisma (uses `@prisma/adapter-pg`, connection
config lives in `prisma.config.ts`, **not** the `datasource` block — this is Prisma 7 behavior,
don't add a `url` back into `schema.prisma`) · BetterAuth (self-hosted, not Clerk/Auth.js) ·
NVIDIA NIM via the OpenAI SDK for AI extraction (`lib/ai.ts` — provider-agnostic by design, swap
via env vars, not code) · Stripe · Cloudflare R2 (S3-compatible) · Render hosting (not Vercel —
Vercel's Hobby tier bans commercial use) · shadcn/ui on the **Base UI** backend (not Radix) ·
React Bits for marketing-page animation/interaction components.

## Conventions

- Role-gated tRPC procedures already exist in `server/trpc/trpc.ts`
  (`candidateProcedure`/`employerProcedure`/`adminProcedure`) — use these instead of checking
  `ctx.session.user.role` manually inside a procedure body.
- One file per external service integration in `lib/` (`prisma.ts`, `auth.ts`, `ai.ts`,
  `storage.ts`, `stripe.ts`) — don't scatter SDK instantiation across route handlers.
  `lib/trpc/` and `lib/auth-client.ts` are the browser-side counterparts.
  `lib/utils.ts` is shadcn's `cn()` helper.
- Route groups in `app/` mirror the three roles: `(candidate)`, `(employer)`, `(admin)`, plus
  `(marketing)` for the public site.
- `/api/health` exists specifically as the UptimeRobot keep-alive ping target (PRD §8) — keep it
  cheap, no DB roundtrip.
- Before adding a new npm dependency, check `docs/PRD.md` §8 first — there's a good chance the
  stack already made a deliberate choice here.
