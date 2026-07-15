# Product Requirement Document (PRD): HireStack

## 1. Problem Statement
Real estate teams increasingly hire overseas virtual assistants, but resumes from this labor
market are inconsistently formatted, often blend multiple gig/freelance clients into a single
"job," and make it hard to verify real employment history and actual software/tool fluency.
Generic job boards don't structure this data, so employers waste time manually vetting
candidates whose backgrounds are genuinely hard to read from a raw resume.

## 2. Product Bet

Verify and structure resume data *before* an employer ever sees it, so search/filter operates
on real structured fields (tools used, years of experience, real-estate relevance, verified
employment type) instead of keyword-matching raw resume text. HireStack is a **verified,
structured staffing directory**, not a two-sided marketplace or general job board — there is no
messaging, no offer/e-signature workflow, and no engagement loop in the MVP.

## 3. Core Value Proposition: Verified Data First

Trust is the product. A candidate profile is not visible to employers until every flagged
ambiguity in their employment history is resolved — either by the candidate or, failing that,
by admin review. Employers never see an "unclear" badge; they only ever see profiles that have
already been fully vetted. This is a deliberate trade-off: candidates may wait on the admin
queue before publishing, in exchange for employers never having to second-guess the data.

## 4. Core Personas

* **The Global Candidate** — an overseas VA whose resume needs to be parsed, reviewed, and
  corrected into a structured, trustworthy profile.
* **The Workspace Recruiter (Employer)** — a real estate team/brokerage member who searches
  structured profiles and manages candidates through a hiring board.
* **The Platform Administrator** — clears two operational queues that gate trust: pending
  software taxonomy approvals, and employment entries flagged for admin review.

## 5. Goals / Success Criteria (MVP)

* A candidate can go from resume upload to a fully published, structured profile in one sitting
  (assuming no admin-review flags block them).
* An employer can search, see a per-job match score, and move a real candidate through the
  Kanban board without hitting a dead end.
* Billing gates correctly block/unblock job activation based on slot limits and subscription
  state.
* The admin queues (software approval, employment-entry review) do not become a bottleneck that
  stalls candidate publishing — this is the single biggest operational risk to the value prop.

## 6. Non-Goals (Out of Scope for MVP)

Per the originating job specification, explicitly excluded from MVP:

* Native video upload
* DISC/personality assessment integration
* WhatsApp/SMS messaging, full internal messaging/chat
* Referral/affiliate system
* Advanced AI candidate ranking/recommendations
* Mobile app
* Blog/CMS
* Advanced analytics or billing dashboard
* Custom calendar system
* Offer letter generator, e-signature workflow
* Full "Hire Assist" workflow (MVP only records a yes/no purchase flag)

The product intentionally stops at "hired" + a note on the Kanban board — it does not close the
loop into an actual hire-completion workflow in this phase.

## 7. Key Product Decisions

These are the load-bearing calls that shape the FRS and schema; see FRS for mechanics.

* **Publish gate**: `isSearchable` (candidate) is derived, not manually toggled — true only when
  zero employment anomalies remain in `PENDING_CANDIDATE` or `FLAGGED_FOR_ADMIN_REVIEW`. There is
  no separate "admin approves candidate" action; admin's only lever is overriding individual
  anomalies.
* **Match score is per-job, not profile-level.** No standalone "profile quality" score exists;
  match score is always computed against a specific job's requirements and is a helper only — it
  never auto-adds a candidate to a hiring board.
* **Employer full-profile access requires two independent gates**: employer account approved by
  admin, AND workspace subscription active (or past-due-but-not-yet-canceled). Unapproved or
  unsubscribed employers may still browse a blurred, PII-free preview of search results (count +
  anonymized cards) as a conversion lever.
* **Job slot enforcement happens at draft→active transition only**, computed live via a query
  (`count(*) active jobs`), not a stored counter. Downgrades that leave an employer over their new
  limit are grandfathered — excess jobs run out their natural lifecycle rather than being
  force-paused. Extensions do not re-trigger a slot check.
* **Subscription lapse (`past_due`) blocks new job activations but does not hide already-active
  jobs** — those stay visible through Stripe's dunning window; only a `canceled` status pulls them.
* **Consultation ($100) and Hire Assist ($2,500) are decoupled one-time purchases**, available
  pre-subscription, with no state machine — just purchase-flag booleans.

## 8. Tech Stack

A deliberate substitution from the originating job spec (NestJS + MongoDB), documented rather
than hidden — see rationale below. Stack is chosen to run entirely on free tiers through MVP/
build phase, with every component upgradeable to a paid tier later as a config change, not a
rewrite.

* **Frontend + API**: Next.js (App Router). API lives in-app via route handlers — no separate
  backend service. For a solo build, one deployable app removes an entire class of cross-service
  type-sync and deployment overhead that a separate NestJS service would add without a
  corresponding benefit at this scope.
* **Client↔server type safety**: tRPC — shares types between frontend and backend directly,
  no separate REST/OpenAPI contract to maintain by hand.
* **App hosting**: Render (free tier), not Vercel — Vercel's Hobby (free) tier explicitly
  prohibits commercial/revenue-generating use, which disqualifies it for a Stripe-billed SaaS.
  Render's free tier spins down after 15 minutes idle (30–60s cold start on next request);
  mitigated with a free UptimeRobot monitor pinging a lightweight `/health` endpoint every 5
  minutes to keep the instance warm — a well-established workaround, not an official guarantee,
  and it also doubles as basic uptime monitoring. This does not remove the cold-start risk
  entirely (Render can still recycle instances), so for any high-stakes client-facing live demo,
  temporarily upgrading to Render's paid tier (~$7/mo) for that window remains the safer call —
  a config-level upgrade, not a rebuild.
* **Database**: PostgreSQL via Neon (free tier — 0.5GB, 100 CU-hrs/month, scale-to-zero, no
  forced pause on idle). The domain is inherently relational — employment periods, ambiguity
  flags, and candidate↔software/skill junctions with edge-level metadata (proficiency, years) are
  a poor fit for a document store, which would force denormalization and hand-rolled joins in
  application code.
* **ORM**: Prisma — schema-first, mature Postgres/TypeScript integration, migrations built in.
* **AI**: NVIDIA NIM free tier (DeepSeek-V3 or GLM), OpenAI-compatible SDK, extraction only (see
  FRS §3–4 for why ambiguity detection is a separate deterministic rule pass, not an LLM judgment
  call). Free tier (1,000 credits, 40 RPM) is sufficient for MVP-volume resume parsing. Written
  provider-agnostic against the OpenAI-compatible interface, so switching to OpenAI proper is a
  config change (base URL + model name) if structured-output reliability on messy real-world
  resumes ever demands it — extraction quality is the one piece of the stack where a quality
  regression would undermine the "verified data" value proposition, so this is worth validating
  against real resumes early, not assumed.
* **Billing**: Stripe — Checkout, Customer Portal, webhooks. Free to integrate (Stripe takes a
  per-transaction cut only, no platform fee).
* **File storage**: Cloudflare R2 (free tier — 10GB storage, 1M writes + 10M reads/month, zero
  egress fees, no 12-month expiry unlike AWS S3's free tier). S3-compatible API, presigned
  uploads — keeps the app server out of the file-upload path.
* **Auth**: BetterAuth — self-hosted, MIT-licensed, no per-MAU cost ever (unlike Clerk, which
  meters monthly active users). Auth data lives in the same Postgres database as the rest of the
  app; built-in email verification, password reset, and role/multi-tenancy support fit the
  candidate/employer/admin + workspace model directly, without vendor lock-in on user data.
