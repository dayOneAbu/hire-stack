"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { ResumeUpload } from "./_components/ResumeUpload";
import { Wizard } from "./_components/Wizard";
import { SoftwareConfirm } from "./_components/SoftwareConfirm";
import { ManualEntry } from "./_components/ManualEntry";
import { OnboardingProgress } from "./_components/OnboardingProgress";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Clock } from "lucide-react";

type Stage = "resume" | "wizard" | "software" | "done";

const STAGE_INDEX: Record<Stage, number> = { resume: 0, wizard: 1, software: 2, done: 3 };

export default function OnboardingPage() {
  // Overrides the derived stage once the user progresses past it in this session — null means
  // "trust server state," so a reload always resumes at the real step instead of restarting at
  // "resume." parseStatus and pending-anomaly count are the only two steps with persisted
  // completion; software-confirm is designed to always be revisitable (FRS §5).
  const [stageOverride, setStageOverride] = useState<Stage | null>(null);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [needsAdminReview, setNeedsAdminReview] = useState(false);
  const status = trpc.candidate.resume.status.useQuery();
  const nextStep = trpc.candidate.wizard.getNextStep.useQuery(undefined, {
    enabled: status.data?.parseStatus === "PARSED",
  });

  const parseStatus = status.data?.parseStatus ?? null;
  const derivedStage: Stage | null =
    parseStatus !== "PARSED" ? "resume" : nextStep.data ? (nextStep.data.totalPending + nextStep.data.totalFlagged > 0 ? "wizard" : "software") : null;
  const stage = stageOverride ?? derivedStage;

  if (status.isLoading || stage === null) {
    return (
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 p-6 pt-12">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl flex-1 space-y-6 p-6 pt-12">
      <OnboardingProgress stepIndex={STAGE_INDEX[stage]} />

      <div
        key={manualEntryOpen ? "manual" : stage}
        className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
      >
        {stage === "resume" && (
          <ResumeUpload
            parseStatus={parseStatus}
            onParsed={() => setStageOverride("wizard")}
            onManualEntry={() => setManualEntryOpen(true)}
          />
        )}

        {manualEntryOpen && (
          <ManualEntry
            onClose={() => setManualEntryOpen(false)}
            onSaved={() => {
              setManualEntryOpen(false);
              setStageOverride("wizard");
            }}
          />
        )}

        {stage === "wizard" && !manualEntryOpen && (
          <Wizard
            onComplete={(flagged) => {
              setNeedsAdminReview(flagged);
              setStageOverride("software");
            }}
            onManualEntry={() => setManualEntryOpen(true)}
          />
        )}

        {stage === "software" && (
          <SoftwareConfirm onDone={() => setStageOverride("done")} />
        )}

        {stage === "done" &&
          (needsAdminReview ? (
            <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
              <Clock className="mx-auto size-8 text-amber-600 dark:text-amber-400" />
              <h1 className="text-xl font-medium">Waiting on admin review</h1>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                One or more entries need a closer look from our team before your profile can go
                live. There&apos;s nothing more to do on your end &mdash; we&apos;ll email you the
                moment it&apos;s resolved.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="mx-auto size-8 text-primary" />
              <h1 className="text-xl font-medium">You&apos;re all set</h1>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                Your profile is verified and visible to employers.
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
