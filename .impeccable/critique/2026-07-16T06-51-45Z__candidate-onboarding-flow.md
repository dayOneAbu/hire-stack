---
target: candidate onboarding flow (landing → sign-up/sign-in → onboarding)
total_score: 20
p0_count: 2
p1_count: 2
timestamp: 2026-07-16T06-51-45Z
slug: candidate-onboarding-flow
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Six of nine mutation call sites show zero pending/sending feedback: buttons stay fully interactive and unlabeled while a network request is in flight. Only `disabled={mutation.isPending}` — no spinner, no text change, no visual delta at all. |
| 2 | Match Between System / Real World | 3 | Copy is plain and mostly jargon-free ("Waiting on admin review" reads well). Minor: "systemNote" text is rendered raw from the anomaly rule engine with no guarantee it reads naturally to a candidate. |
| 3 | User Control and Freedom | 2 | No back button anywhere in the wizard. Once an answer is submitted there is no undo. `ManualEntry` has Cancel, but mid-wizard there's no way to skip/return to a question. |
| 4 | Consistency and Standards | 2 | Four question components (`GroupingQuestion`, `GapQuestion`, `WageQuestion`, `ConfirmDenyQuestion`) each reimplement pending state differently — one disables the button only, none show a spinner or "Saving…" label. `ResumeUpload` is the only place with real progress feedback; the rest of the flow doesn't match that bar. |
| 5 | Error Prevention | 2 | Numeric wage input has no upper bound or sanity check (a candidate can type 999999). Date-range inputs in `GroupingQuestion`/`ManualEntry` don't prevent end-date-before-start-date. |
| 6 | Recognition Rather Than Recall | 3 | Labels are visible and text, not icon-only. Good. |
| 7 | Flexibility and Efficiency | 2 | No keyboard-first path through radio options beyond native focus; no way to jump back a step once progressed. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean, no clutter, appropriately restrained for the register. |
| 9 | Error Recovery | 1 | **Every mutation in the wizard has no `onError` handler at all** (`GroupingQuestion`, `GapQuestion`, `WageQuestion`, `ConfirmDenyQuestion`, `SoftwareConfirm.confirm`, `ManualEntry.create`). If a mutation fails — network drop, validation error, session expiry — the button just becomes clickable again with **zero indication anything went wrong**. The candidate re-clicks into a silent void. |
| 10 | Help and Documentation | 1 | No help/support link anywhere in the flow. A candidate stuck on "Waiting on admin review" forever (no timeline given) has nowhere to go. |
| **Total** | | **20/40** | **Acceptable, trending toward Poor — the error-handling and status-visibility gaps are severe enough to actively hurt the exact anxious-candidate persona this product is built for.** |

## Anti-Patterns Verdict

**LLM assessment**: Visually this is restrained and doesn't scream "AI slop" — no gradient text, no uppercase eyebrows, no glass cards, no hero-metric template. The detector agrees (clean scan, 0 findings). But "doesn't look like AI slop" and "communicates system state" are different axes, and this flow fails the second one badly. The core problem isn't taste, it's that **half the interactive surface is silently async** — every `mutation.isPending` currently maps to nothing but a disabled attribute. A disabled button with no other change reads as "broken" or "did my click even register," not "working on it."

**Deterministic scan**: `detect.mjs` returned a clean scan (0 findings) across `app/page.tsx`, `app/(marketing)/*`, and `app/(candidate)/onboarding/**`. This detector targets visual/copy anti-patterns (gradient text, eyebrows, side-stripes, hero-metric templates) — it does not check for missing async-state handling, which is the actual finding here. Treat the clean scan as "no visual slop," not "no UX problems."

**Visual overlays**: Not available. Browser automation couldn't launch in this environment (no installable Chromium binary, confirmed via a prior `playwright install` attempt that failed with no network path to the browser download). This critique is source-only; a follow-up visual pass is recommended once a browser is available.

## Overall Impression

The visual foundation (from the last pass) is solid — restrained, on-brand, no AI-slop tells. But the actual UX problem the user is flagging is real and severe: **this flow was built assuming the happy path always works.** Every mutation click starts a network request and the UI's only acknowledgment is "the button stops being clickable." There's no sending state, no success confirmation beyond the page changing, and — critically — **no error state at all** in six of nine interactive components. A candidate on a slow connection or flaky wifi (a named risk in PRODUCT.md — "may be on slower connections/older devices") who hits a failed mutation gets total silence. That's not a polish gap, it's a trust failure in a product whose entire pitch is trust.

## What's Working

- **`ResumeUpload`'s upload state** is the one place doing this right: drag-active styling, live percentage, a real progress bar via XHR. This is the template the rest of the flow should be held to, not the exception.
- **The "done" vs "waiting on admin review" split** (page.tsx:74-93) correctly separates two states that used to be conflated — good instinct, this is exactly the kind of state-honesty the rest of the flow needs more of.
- **`OnboardingProgress`** gives real orientation ("Step 2 of 4," segmented bar) — addresses the "how much is left" anxiety at the macro level. It just doesn't extend down into the micro-interactions.

## Priority Issues

**[P0] Every wizard/software/manual-entry mutation has no error handling** — `GroupingQuestion.tsx:33-35`, `GapQuestion.tsx:16-18`, `WageQuestion.tsx:19-21`, `ConfirmDenyQuestion.tsx:25-27`, `SoftwareConfirm.tsx:11-13`, `ManualEntry.tsx:22-28`.
**Why it matters**: tRPC mutations reject on network failure, session expiry, or server validation error. None of these six call sites pass `onError`. On failure the button re-enables silently — the candidate has no idea their answer wasn't saved, and may believe they've progressed when they haven't. For a flow candidates describe as "my livelihood depends on this," silent failure is the single worst thing this UI can do.
**Fix**: Add a shared error-toast pattern (sonner is already installed — `components/ui/sonner.tsx`) or an inline `<p className="text-destructive">` under each mutation's controls, wired to `onError: (e) => setError(e.message)`. One shared hook (`useMutationFeedback` or similar) would fix all six sites with one small addition, not six bespoke ones.
**Suggested command**: `/impeccable harden`

**[P0] No "Sending…" / pending state on any wizard question button** — `GroupingQuestion.tsx:127-129`, `GapQuestion.tsx:27-32`, `WageQuestion.tsx:28-33`, `ConfirmDenyQuestion.tsx:40-45`, `SoftwareConfirm.tsx:43-49`.
**Why it matters**: `disabled={mutation.isPending}` is the only signal. The button doesn't change label, doesn't show a spinner. Nielsen heuristic #1 (visibility of system status) fails outright here — a candidate on a slow connection sees a button that looks identical whether it's idle, mid-request, or (per the P0 above) failed. This is the "stream of data" gap referenced: `getNextStep` refetches after every mutation and the UI gives no indication a refetch/transition is happening between "answer submitted" and "next question appears" — it can look like a freeze.
**Fix**: Standardize a `Button` loading treatment (`isPending` prop → replaces label with a spinner icon + "Saving…") in `components/ui/button.tsx` so all six call sites get it by changing one prop, not six custom implementations. Also show a lightweight transition/skeleton state in `Wizard.tsx` between `mutation.isPending` and the next `getNextStep` query resolving, so the gap between "answered" and "next question rendered" is never blank/frozen.
**Suggested command**: `/impeccable harden`, then `/impeccable animate` for the transition polish

**[P1] `resumeParseStatus` polling has no visible countdown or explicit progress, and `FAILED` after long polling looks identical to `FAILED` immediately** — `ResumeUpload.tsx:31-42, 85-93`.
**Why it matters**: The card just says "Processing your resume… This usually takes a few seconds," for however long the poll actually takes (could be much longer if the AI extraction is slow or NIM free-tier rate-limits). There's no elapsed-time indicator, no "still working" reassurance past the first few seconds, and no distinction between "the AI took 45s to think" and "we've been stuck." This is the "stream of data" the user is pointing at — resume parsing is a multi-stage async pipeline (fetch → extract text → AI call → anomaly rules → DB writes) and the UI represents all of it as one static sentence.
**Fix**: At minimum, add an elapsed-time-aware message (e.g. switch copy after 10s to "Still working — this can take up to a minute for longer resumes"), and consider a staged label if the backend can report which pipeline stage it's in. Cheapest real gain: a subtle indeterminate progress bar (not a static spinner) so 3s and 45s don't feel identical.
**Suggested command**: `/impeccable clarify`

**[P1] No back/undo control anywhere inside the wizard, and manual-entry escape hatch loses the "why am I here" context** — `Wizard.tsx` (no back action at all); `ManualEntry.tsx:19-107` (opens with no reference to which anomaly triggered it, if launched from `onManualEntry` inside a question).
**Why it matters**: Nielsen heuristic #3 (user control and freedom) scores a 2 here. If a candidate misclicks "Confirm" instead of "Deny," or picks the wrong grouping answer, there's no way back — they'd need to use "Edit this entry manually" (Wizard.tsx:78-80) as a workaround, which isn't obviously the undo path from a first-timer's perspective.
**Fix**: At minimum, surface a confirmation step for irreversible answers (grouping split especially — it deletes and recreates EmploymentPeriod rows), or make the manual-entry escape hatch copy explicit ("Made a mistake? Edit this entry" rather than "Something wrong?").
**Suggested command**: `/impeccable clarify`

**[P2] Software confirm list gives no per-item pending/removed feedback** — `SoftwareConfirm.tsx:39-52`.
**Why it matters**: Clicking "Not accurate" fires a mutation that deletes the row; the only feedback is the list re-rendering (via invalidate) once the request completes. Between click and re-render, the button is disabled list-wide (`confirm.isPending` disables every row's button, not just the clicked one) with no per-row indicator of which one is being removed.
**Fix**: Track pending softwareId locally, show a per-row spinner/strike-through only on the clicked item, and don't disable the whole list for one row's mutation.
**Suggested command**: `/impeccable harden`

## Persona Red Flags

**Jordan (First-Timer, non-native English speaker, possibly slow connection)**: Submits a wage answer, sees no visible change for a beat while the mutation is in flight (no spinner, no "Saving…"), assumes the click didn't register, clicks again — this is a duplicate-submission risk with zero protection (the button is only disabled via `mutation.isPending`, which does prevent double-fire, but visually looks unresponsive in the gap before `isPending` flips). If the mutation then fails (session timeout, flaky connection), there's no error message anywhere — Jordan is now stuck on a question that silently isn't saving, with no path forward and no way to know why.

**Riley (Stress Tester)**: Refreshes mid-wizard — state is fully server-derived (`getNextStep` re-queries), so that's actually fine. But: submits a grouping answer, then immediately navigates away before the mutation resolves — no `beforeunload` guard, so an in-flight anomaly resolution can be silently lost. Also: the wage input (`WageQuestion.tsx:27`) has no `max`, so entering `99999999` passes client validation (`parsed > 0`) and hits the server with an absurd hourly rate — worth checking server-side bounds separately, but the UI gives zero indication this is implausible.

## Minor Observations

- `ResumeUpload`'s "Processing your resume…" card (85-93) has no footer/exit action at all — a candidate stuck here (parse taking unusually long) has no manual-entry escape until it resolves to `FAILED`. Consider surfacing the manual-entry option after a timeout even while still `PENDING`.
- `ConfirmDenyQuestion`'s correction `<Input>` (line 37) has no `aria-invalid`/character limit shown even though it maps directly to `jobTitle` on `INCOMPLETE_ENTRY` — worth a max-length hint.
- The amber "waiting on admin review" card (`page.tsx:76-84`) doesn't say *how long* review typically takes — "we'll email you" with no SLA reads as open-ended, which is exactly the ambiguity this section was built to remove.

## Questions to Consider

- What should happen, concretely, if a wizard mutation fails mid-flow — retry automatically, show a toast with a manual retry button, or something else? This needs an answer before `/impeccable harden` can be scoped precisely.
- Is resume-parsing pipeline stage information available server-side (extract → AI call → rule pass), or would a staged progress UI need new backend plumbing to be honest rather than fake?
- Should the wizard support literal "go back one question" for non-destructive answer types (confirm/deny, wage), even though the grouping-split answer is inherently one-way once submitted?
