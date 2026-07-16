"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { ResumeUpload } from "./_components/ResumeUpload";
import { Wizard } from "./_components/Wizard";
import { SoftwareConfirm } from "./_components/SoftwareConfirm";
import { ManualEntry } from "./_components/ManualEntry";
import { Skeleton } from "@/components/ui/skeleton";

type Stage = "resume" | "wizard" | "software" | "done";

export default function OnboardingPage() {
  const [stage, setStage] = useState<Stage>("resume");
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const status = trpc.candidate.resume.status.useQuery();

  if (status.isLoading) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const parseStatus = status.data?.parseStatus ?? null;

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      {stage === "resume" && (
        <ResumeUpload
          parseStatus={parseStatus}
          onParsed={() => setStage("wizard")}
          onManualEntry={() => setManualEntryOpen(true)}
        />
      )}

      {manualEntryOpen && (
        <ManualEntry
          onClose={() => setManualEntryOpen(false)}
          onSaved={() => {
            setManualEntryOpen(false);
            setStage("wizard");
          }}
        />
      )}

      {stage === "wizard" && !manualEntryOpen && (
        <Wizard
          onComplete={() => setStage("software")}
          onManualEntry={() => setManualEntryOpen(true)}
        />
      )}

      {stage === "software" && (
        <SoftwareConfirm onDone={() => setStage("done")} />
      )}

      {stage === "done" && (
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-medium">You&apos;re all set</h1>
          <p className="text-sm text-muted-foreground">
            Your profile is being reviewed. Once every item is resolved, it becomes visible to
            employers automatically.
          </p>
        </div>
      )}
    </div>
  );
}
