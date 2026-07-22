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
import { LandingHeader } from "@/components/landing-header";

const steps = [
  {
    icon: FileSearch,
    title: "Upload a resume",
    body: "Drop in a resume and AI reads it for you — pulling out roles, tools, and dates automatically. No forms to fill in by hand.",
  },
  {
    icon: ShieldCheck,
    title: "Catch the sketchy parts",
    body: "If dates overlap, or a job history looks patched together, the system flags it right away and asks the candidate to explain — instead of letting it slide through unnoticed.",
  },
  {
    icon: Wrench,
    title: "Confirm real skills",
    body: "Candidates check off the actual tools they've used, so employers aren't just trusting a list of buzzwords on a resume.",
  },
  {
    icon: KanbanSquare,
    title: "Search and shortlist",
    body: "Employers search on that cleaned-up, trustworthy data and drag candidates through a simple board — organized however makes sense for them, not a rigid pipeline.",
  },
  {
    icon: MessageSquare,
    title: "Chat and hire",
    body: "Messaging and offers live in the same place, so the whole conversation — from 'hey, interested?' to a signed offer — stays in one thread.",
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
    href: "/sign-up?as=employer",
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
    href: "/sign-up?as=employer",
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
      <LandingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-128 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]"
        />
        <div className="relative mx-auto max-w-4xl px-6 pt-24 pb-20 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            A demo project, built end-to-end to show how I think and build
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            A hiring platform that checks if a resume is telling the{" "}
            <span className="text-primary">truth</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            HireStack is a project I built to solve a real, specific problem: overseas hiring
            for real estate virtual assistants, where resumes are easy to pad and hard to verify.
            It's also my way of showing what I can build — from the product thinking down to
            the code. Poke around, hire a fake VA, or just see how the pieces fit together.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/sign-up?as=employer" className={cn(buttonVariants({ size: "lg" }), "group")}>
              Try it as an employer
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/sign-up" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "group")}>
              Try it as a candidate
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              How it actually works, step by step
            </h2>
            <p className="mt-4 text-muted-foreground">
              There's no admin who manually "approves" a candidate. A profile becomes
              searchable on its own, the moment nothing about it looks off anymore.
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
              How pricing would work, if this were live
            </h2>
            <p className="mt-4 text-muted-foreground">
              This is a demo, so no one's actually being charged — but the billing logic
              (job slots, tiers, upgrades) is fully built. Here's what the plans look like.
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
            Curious how the whole thing fits together?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Sign up, post a fake job, upload a resume, and walk through the whole flow yourself.
            It's the fastest way to see how it works — and what I built.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/sign-up?as=employer" className={cn(buttonVariants({ size: "lg" }), "group")}>
              Try it now, free
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
