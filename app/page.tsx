import Link from "next/link";
import {
  ShieldCheck,
  FileSearch,
  Wrench,
  KanbanSquare,
  MessageSquare,
  Check,
  ArrowRight,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: FileSearch,
    title: "Upload & extract",
    body: "A candidate uploads their resume. AI extraction turns it into structured fields — roles, tools, tenure — no manual data entry.",
  },
  {
    icon: ShieldCheck,
    title: "Flag & resolve",
    body: "Overlapping dates, gig-blended job history, and unverifiable tenure get flagged automatically. The candidate resolves it, or it goes to admin review.",
  },
  {
    icon: Wrench,
    title: "Verify software fluency",
    body: "Candidates confirm the specific tools they've actually used — not keyword-stuffed resumes. Employers search on real fluency, not guesses.",
  },
  {
    icon: KanbanSquare,
    title: "Search, shortlist, hire",
    body: "Employers filter on structured, trustworthy data and move candidates through a free-form Kanban board — no rigid pipeline forcing your process.",
  },
  {
    icon: MessageSquare,
    title: "Message & close",
    body: "Built-in messaging and offers keep the whole hire — from first contact to signed offer — in one place.",
  },
];

const tiers = [
  {
    name: "Starter",
    slots: "1 active job slot",
    blurb: "For a single open role.",
    features: [
      "1 active job posting",
      "Full candidate search & filters",
      "Kanban pipeline per job",
      "Messaging & offers",
    ],
    cta: "Get started",
    href: "/sign-up",
    highlighted: false,
  },
  {
    name: "Team",
    slots: "3 active job slots",
    blurb: "For teams hiring across roles.",
    features: [
      "3 active job postings",
      "Full candidate search & filters",
      "Kanban pipeline per job",
      "Messaging & offers",
      "Priority admin review queue",
    ],
    cta: "Get started",
    href: "/sign-up",
    highlighted: true,
  },
  {
    name: "Enterprise",
    slots: "Custom slot limit",
    blurb: "For high-volume hiring.",
    features: [
      "Custom active job slots",
      "Everything in Team",
      "Dedicated onboarding",
      "Custom contract terms",
    ],
    cta: "Talk to sales",
    href: "mailto:hello@hirestack.example",
    highlighted: false,
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <ShieldCheck className="size-5 text-primary" />
            HireStack
          </div>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link href="/sign-up" className={cn(buttonVariants({ size: "sm" }))}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-128 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]"
        />
        <div className="relative mx-auto max-w-4xl px-6 pt-24 pb-20 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            Built for overseas VA recruiting in real estate
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Hire virtual assistants whose resumes are actually{" "}
            <span className="text-primary">true</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            HireStack verifies and structures resume data before an employer ever sees it —
            so search and filtering run on real employment history and confirmed tools,
            not keyword-stuffed guesswork.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/sign-up" className={cn(buttonVariants({ size: "lg" }), "group")}>
              Start hiring
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="#how-it-works" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              From resume to hire, in one verified pipeline
            </h2>
            <p className="mt-4 text-muted-foreground">
              No separate "approve candidate" step. A profile becomes searchable the moment
              every flagged inconsistency is resolved — nothing is toggled on by hand.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="relative rounded-2xl border border-border bg-card p-6 shadow-sm lg:not-last:after:absolute lg:not-last:after:top-11 lg:not-last:after:-right-3 lg:not-last:after:h-px lg:not-last:after:w-6 lg:not-last:after:bg-border"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="size-5" />
                </div>
                <div className="mt-4 text-xs font-medium text-muted-foreground">
                  Step {i + 1}
                </div>
                <h3 className="mt-1 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Pricing that scales with how much you're hiring
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every tier includes full candidate search, the Kanban pipeline, and messaging.
              The only thing that changes is how many roles you can run at once.
            </p>
          </div>

          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`flex flex-col rounded-2xl border p-8 ${
                  tier.highlighted
                    ? "border-primary bg-card shadow-lg ring-1 ring-primary"
                    : "border-border bg-card"
                }`}
              >
                {tier.highlighted && (
                  <span className="mb-4 inline-block w-fit rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Most popular
                  </span>
                )}
                <h3 className="text-xl font-semibold">{tier.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{tier.blurb}</p>
                <p className="mt-4 text-2xl font-semibold">{tier.slots}</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={tier.href}
                  className={cn(
                    buttonVariants({ variant: tier.highlighted ? "default" : "outline" }),
                    "mt-8"
                  )}
                >
                  {tier.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Stop guessing whether a resume is telling the truth.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Post your first job in minutes and search candidates whose employment history
            has already been verified.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/sign-up" className={cn(buttonVariants({ size: "lg" }), "group")}>
              Get started free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            HireStack
          </div>
          <p>&copy; {new Date().getFullYear()} HireStack. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
