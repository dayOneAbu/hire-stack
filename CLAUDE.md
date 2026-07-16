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

## Taking real browser screenshots / driving the app in this sandbox

The built-in `mcp__playwright__*` browser tools don't work here — they're hardcoded to look for
Chromium at `/opt/google/chrome/chrome`, which doesn't exist in this environment, and
`npx playwright install` fails too (needs `sudo` for OS deps, no password access).

What actually works: Chromium installed via Ubuntu's Software Store as a **flatpak**. Its real
binary is at:

```text
/var/lib/flatpak/exports/bin/org.chromium.Chromium
```

Drive it with Playwright's Node library API directly (not the MCP tool):

1. `npm install playwright-core` in a scratch directory (not `npx` — it needs to resolve locally).
2. Launch pointed at that binary:
   ```js
   import { chromium } from "playwright-core";
   const browser = await chromium.launch({
     executablePath: "/var/lib/flatpak/exports/bin/org.chromium.Chromium",
     args: ["--no-sandbox", "--disable-gpu"],
   });
   ```
3. Write screenshots under `$HOME` (e.g. `~/shots/`), not `/tmp` scratch paths — the flatpak
   sandbox blocks writes outside `$HOME`.
4. Start `pnpm dev` first, then navigate/screenshot/click through `page` as normal. Useful at both
   mobile (390×844) and desktop (1280×900) viewports.

To reach authenticated/multi-step candidate screens (wizard, software-confirm) quickly without a
real AI parse, seed test data directly via Prisma using the same adapter pattern as `lib/prisma.ts`
(`@prisma/adapter-pg`, not a bare `new PrismaClient()` — Prisma 7 needs the adapter). Delete any
seeded test users (`prisma.user.deleteMany({ where: { email: { contains: "<test prefix>" } } })`)
once done — this writes to the real dev database.

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
