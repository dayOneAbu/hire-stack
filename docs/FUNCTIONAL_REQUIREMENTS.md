# Functional Requirements Specification (FRS)

## 1. Authentication, Tenant-Isolation, and Security

Secure JWT integration in HTTP-only cookies and Workspace database segregation rules.

* **Email verification** does not block wizard access — a candidate may start (and complete) the
  resume upload and clarification wizard before verifying their email, to minimize drop-off.
  Verification is required before the publish gate (§4.3) allows `isSearchable = true`.
* **Password reset**: standard token-link flow, no product-specific behavior.

## 2. The Dynamic Taxonomy System

Alias mapping and dynamic link indexing by Industry. AI-detected software/skills not already in
the taxonomy are created with `TaxonomyStatus.SUGGESTED_BY_AI` and land in the admin approval
queue (see §6) rather than blocking the candidate wizard.

## 3. Resume Parsing Pipeline

1. Candidate uploads resume (PDF/DOC/DOCX) → stored raw.
2. Text extracted, sent to OpenAI with structured-output/JSON-schema mode targeting the
   `EmploymentPeriod` / `CandidateSoftware` / `CandidateSkill` shapes directly — extraction and DB
   schema share one contract.
3. A deterministic rule pass (not the LLM) evaluates each extracted `EmploymentPeriod` and creates
   `EmploymentAnomaly` rows where triggered (see §4). The LLM is responsible for extraction only;
   ambiguity detection is rule-based for reliability and cost.
4. Extracted software mentions are fuzzy-matched against the `Software` table; no match creates a
   `SUGGESTED_BY_AI` row rather than blocking the pipeline.

## 4. Employment Clarification Wizard

### 4.1 Anomaly triggers (rule pass, per `EmploymentPeriod`)

| `AmbiguityRule` | Trigger |
|---|---|
| `TIMELINE_GAP` | Gap ≥ ~60 days between this period's end and the next period's start |
| `CONCURRENT_EMPLOYERS` | Two periods with overlapping date ranges |
| `MISSING_WAGE_RANGE` | No `documentedHourlyRate` and no wage text found |
| `FREELANCE_INDICATION` | Freelance/contract/multi-client language in title or description, or same company name reused across 3+ periods with distinct date ranges |
| `UNUSUAL_JOB_DURATION` | Duration < 30 days or > 15 years |
| `CRITICAL_CERT_MISSING` | Industry-relevant certification referenced in text but not captured as structured data |
| `INCOMPLETE_ENTRY` | Missing job title and/or missing start/end dates |

### 4.2 Wizard flow

The wizard walks each `EmploymentPeriod` that has ≥1 anomaly in `PENDING_CANDIDATE`, oldest to
newest. Multiple anomalies on one period are shown as sequential sub-steps on the same entry
card, not separate wizard steps.

* **Grouping question** (triggered by `CONCURRENT_EMPLOYERS` or `FREELANCE_INDICATION`):
  > "Was this one employer/job, or multiple clients/jobs grouped together?"
  > Options: One employer/job only · One agency, multiple client assignments · Multiple separate
  > clients/jobs · Freelance/contract/gig work · Not sure / needs admin review

  - "Multiple separate clients" splits the one `EmploymentPeriod` into several, each inheriting
    the parent's rough date range; candidate fills in per-client detail on each new entry.
  - Any other concrete answer sets `EmploymentPeriod.employmentType` and resolves the anomaly to
    `RESOLVED_BY_CANDIDATE`.
  - "Not sure" resolves the anomaly to `FLAGGED_FOR_ADMIN_REVIEW`.

* **Gap question** (`TIMELINE_GAP`): free-text or short-option prompt ("studying," "unemployed,"
  "freelance not listed," "other") → `RESOLVED_BY_CANDIDATE`, answer stored in
  `candidateAnswer`.

* **Wage prompt** (`MISSING_WAGE_RANGE`): direct form field, not a clarification question.

* **Confirm/deny** (`UNUSUAL_JOB_DURATION`, `CRITICAL_CERT_MISSING`, `INCOMPLETE_ENTRY`): short
  yes/no or fill-in prompt.

### 4.3 Publish gate

`Candidate.isSearchable` may only be set `true` when **zero** `EmploymentAnomaly` rows remain in
`PENDING_CANDIDATE` or `FLAGGED_FOR_ADMIN_REVIEW` across all of that candidate's
`EmploymentPeriod`s. There is no separate admin "approve candidate" action — admin's only lever
is resolving individual anomalies to `OVERRIDDEN_BY_ADMIN` or `IGNORED`. A candidate with any
`FLAGGED_FOR_ADMIN_REVIEW` anomaly is blocked from publishing until admin clears it — this is a
deliberate trade-off in favor of employers never seeing unverified data (see PRD §3).

## 5. Software and Skills Confirmation

Independent of the employment wizard, always shown. Candidate confirms each AI-detected
`CandidateSoftware` row: used/never used, proficiency (`Proficiency` enum), years used, currently
using (yes/no). Unrecognized software creates a `SUGGESTED_BY_AI` taxonomy entry (§2) and does
not block the candidate.

## 6. Admin Operations

Two live, SLA-bearing worklists — not optional CRUD:

* **Pending software queue**: `Software` rows with `status = SUGGESTED_BY_AI`. Admin
  approves (→ `APPROVED_GLOBAL`) or merges into an existing entry (→ `MERGED`,
  `mergedIntoId` set).
* **Flagged employment review queue**: `EmploymentAnomaly` rows with
  `status = FLAGGED_FOR_ADMIN_REVIEW`. Admin resolves to `OVERRIDDEN_BY_ADMIN` or `IGNORED`.
  Queue latency directly gates candidate publish rate (§4.3) — the single largest operational
  risk to the product's value proposition.

## 7. Employer Access Gating

`canViewFullProfile = employer.approved AND workspace.subscriptionStatus IN (active, past_due)`.

* Not approved → "pending admin approval" state, no action available.
* Approved but not subscribed → "subscribe to view full profiles," drives to Stripe Checkout.
* Unapproved or unsubscribed employers may still browse a blurred, PII-free preview of search
  results (result count + anonymized cards) — search execution is unaffected, only the detail
  view is gated. The preview respects the employer's active filters (software, skills, rate
  range), so an unsubscribed employer can validate that supply exists for their specific need
  before paying.

## 8. Job Slot Logic

* Tier → slot mapping (source of truth, applied to `Workspace.jobSlotLimit` on checkout/webhook):
  `STARTER` = 1, `TEAM` = 3, `ENTERPRISE` = admin-set custom value, `FREE` = 0 (pre-subscription
  default). This mapping lives in application config, not the schema — `jobSlotLimit` is always
  the enforced value regardless of tier, so the tier itself is descriptive, not authoritative.
* Slot check runs only at the `DRAFT → ACTIVE` transition, computed live via
  `count(*) WHERE workspaceId = ? AND status = 'ACTIVE'` — no stored counter.
* Draft jobs never count against the limit.
* Active jobs run 30 days (`expiresAt = activatedAt + 30d`), extendable once. Extension does not
  re-trigger a slot check (same job, same slot).
* Closing, filling, canceling, or expiring a job frees the slot implicitly (the count query
  simply excludes it).
* A daily cron transitions `ACTIVE → CLOSED`/expired where `expiresAt < now()`.
* Tier downgrades that leave an employer over their new slot limit are grandfathered — excess
  active jobs are not force-paused, they simply run out their natural lifecycle. Only new
  activations are blocked once over limit.
* Enterprise tier is not self-serve: admin manually sets a custom `jobSlotLimit` and manages
  `subscriptionStatus` directly (no Stripe webhook drives it).

## 9. Subscription & Billing

* Stripe webhook (`customer.subscription.updated` / `.deleted`) drives `subscriptionStatus` and
  `subscriptionTier` for self-serve tiers (Starter, Team).
* `past_due` blocks new job activations but does **not** hide already-active jobs — they remain
  visible through Stripe's dunning/retry window. Only `canceled` pulls active jobs from
  candidate-facing search.
* Consultation ($100 one-time) and Hire Assist ($2,500 one-time) are decoupled purchase-flag
  booleans on `Workspace`, available pre-subscription, with no state machine. Consultation
  payment reveals an external booking link (e.g. Calendly) on success.

## 10. Match Score

Per-`(candidateId, jobPostId)` only — there is no profile-level score. Computed on demand or
cached on candidate publish / job activation, not treated as a source of truth. A helper signal
only: it never automatically adds a candidate to a hiring board.

Weighted formula. All four sub-scores plus the overall are persisted as columns on
`JobApplication` (`softwareScore`, `experienceScore`, `compScore`, `availabilityScore`,
`overallMatchScore`) once a candidate is added to a job's board, so the employer UI can show a
breakdown rather than a single opaque number. Before a candidate is added to a board, the score
is computed on demand for search/preview and not persisted anywhere.

```text
overallScore = 0.35·softwareScore + 0.30·experienceScore + 0.20·compScore + 0.15·availabilityScore

softwareScore     = (Σ matched required software, weighted by proficiency met/required)
                    / total required software
experienceScore   = min(1, years of real-estate-relevant experience / job's implied
                    experience requirement)
compScore         = 1 if candidate's target rate range overlaps job's target rate range,
                    else linear falloff to 0 at 2x the gap between ranges
availabilityScore = min(1, candidate.weeklyAvailability / job.requiredHoursMin)
```

## 11. Kanban Hiring Board

Default stages: `INBOX → SCREENING → TECHNICAL_ASSESSMENT → INTERVIEW → OFFER → HIRED /
REJECTED`. Employer manually adds candidates (match score is advisory, not automatic). Stage
transitions are fully free-form — any stage-to-stage move is valid in either direction (including
skipping stages, or moving a candidate out of `REJECTED` back into an active stage), with no
workflow enforcement. Every move is logged to `ApplicationHistory` regardless of direction.
Candidate summary card shows name, photo, current match score for that job, top matched
software/skills, and days in current stage; `Note`s are shown on expand, not on the card face. No
internal messaging in MVP.

## 12. Job Posting, Templates & Compensation Guidance

* **Job template**: a saved, reusable `JobPost` an employer can clone as a starting point for a
  new post — not an admin-curated content library. "Template" means duplicate-an-existing-post,
  keeping this out of admin's content-management surface. No `JobTemplate` model or `isTemplate`
  flag exists in the schema; this is a UI-level "clone this post" action against the existing
  `JobPost` table, nothing more.
* **Compensation guidance**: shown while creating a post, computed live as an aggregate range
  (`targetHourlyRateMin`/`Max`) across existing published candidates in the same `Industry` —
  not a maintained lookup table, so it stays current automatically. Admin's compensation-range
  management (job spec §Admin Portal) becomes optional manual seed/override data for industries
  with too few candidates to aggregate from yet, rather than the primary source.

## 13. Notes & Collaboration Visibility

All `Note`s on a `JobApplication` are visible to every `EmployerStaff` member in that workspace —
no per-note visibility rules or @mentions. A workspace represents one team; per-note privacy adds
complexity the MVP doesn't need.

## 14. Admin Dashboard Shape

Beyond the two operational queues (§6), admin has a basic searchable list/lookup of candidates
and employers for support purposes (find a user, check status) — no bulk operations, no
analytics dashboard. The two queues remain the only *actionable* admin surfaces in MVP.

## 15. Employer Search & Profile Visibility

Filters map directly to structured fields — `Industry`, `Software` (with minimum proficiency),
`Skill`, hourly rate range, `weeklyAvailability`, real-estate relevance — never free text.
Because search only ever queries `isSearchable = true` candidates, every result has already
cleared the full verification gate; there is no partial-trust result to design around.

* **Blurred preview** (employer not yet fully gated, §7): result count, avatar placeholder, top
  2–3 skill/software tags, rate *range bucket* rather than exact figures, no name, no employment
  history detail.
* **Full card** (fully gated employer): full name, complete employment history, per-software
  confirmed proficiency/years, and the match score against the specific job being viewed from.

## 16. Resume Parsing Reliability & Failure Modes

* **Upload validation**: file type (PDF/DOC/DOCX) and size are checked before any AI call is
  made, to avoid spending API budget on invalid uploads.
* **Non-resume / unreadable files**: the extraction call must return a confidence/validity signal
  alongside structured data. Near-zero confidence across the board is treated as "could not
  parse," not as an empty-but-valid profile.
* **Partial misreads are not a separate error path** — a real resume that the model extracts
  incompletely (missing title, missing dates, missing wage) surfaces through the same rule pass
  and `EmploymentAnomaly` mechanism as genuine ambiguity (§4). Parsing weakness and employment
  ambiguity are handled by one mechanism, not two.
* **Hard failures** (API error, timeout, genuinely unparseable file — e.g. a scanned image with no
  extractable text, common in this candidate population): `Candidate.resumeParseStatus` includes
  a `FAILED` state. Candidate is offered re-upload or manual entry as a fallback — manual entry is
  the bottom-of-funnel safety net and must not be a dead end, since scanned/unusual resume formats
  are expected to be common for this user base. A candidate who manual-enters without ever
  successfully parsing a resume simply has `rawResumeUrl`/`resumeParseStatus` left `null` and
  populates `EmploymentPeriod` rows directly — the publish gate (§4.3) doesn't care how entries
  were created, only that anomalies are resolved.
* There is no distinct "needs review" parse status — whether a candidate still has outstanding
  work is entirely derived from open `EmploymentAnomaly` rows, not a separate flag on the parse
  itself.
* **Cost control**: parse attempts are capped per candidate per day (e.g. 5) rather than
  one-shot-only, to allow for genuine mistakes (wrong file, retry after fixing a scan) without
  unbounded API spend.
* **Re-upload after publish**: replaces all `EmploymentPeriod`/`EmploymentAnomaly` data entirely
  and re-runs the wizard from scratch. No merge with prior candidate corrections — re-upload is
  treated as an infrequent "update my resume" event, and merging structured extraction with
  hand-edited data is not worth the complexity for MVP.
