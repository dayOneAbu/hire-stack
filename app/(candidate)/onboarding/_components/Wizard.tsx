"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupingQuestion } from "./questions/GroupingQuestion";
import { GapQuestion } from "./questions/GapQuestion";
import { WageQuestion } from "./questions/WageQuestion";
import { ConfirmDenyQuestion } from "./questions/ConfirmDenyQuestion";

// Answers to these rule types resolve a single still-existing anomaly row, so they can be
// safely un-resolved. CONCURRENT_EMPLOYERS/FREELANCE_INDICATION (GroupingQuestion) are excluded
// when the candidate picked "multiple separate clients" — that answer deletes the original
// EmploymentPeriod and creates new ones, so there's no single anomaly row left to restore.
const UNDOABLE_RULE_TYPES = new Set([
  "TIMELINE_GAP",
  "MISSING_WAGE_RANGE",
  "UNUSUAL_JOB_DURATION",
  "CRITICAL_CERT_MISSING",
  "INCOMPLETE_ENTRY",
]);

type AnsweredEntry = { anomalyId: string; ruleType: string; undoable: boolean };

export function Wizard({
  onComplete,
  onManualEntry,
}: {
  onComplete: (needsAdminReview: boolean) => void;
  onManualEntry: () => void;
}) {
  const utils = trpc.useUtils();
  const nextStep = trpc.candidate.wizard.getNextStep.useQuery();
  const [history, setHistory] = useState<AnsweredEntry[]>([]);

  const undo = trpc.candidate.wizard.undoAnswer.useMutation({
    onSuccess: () => {
      setHistory((h) => h.slice(0, -1));
      void utils.candidate.wizard.getNextStep.invalidate();
    },
    onError: (e) => toast.error(e.message || "Couldn't undo that. Try again."),
  });

  function afterAnswer(isSearchable: boolean) {
    void utils.candidate.wizard.getNextStep.invalidate();
    if (isSearchable) onComplete(false);
  }

  const { period, anomalies, totalPending, totalFlagged } = nextStep.data ?? {
    period: null,
    anomalies: [],
    totalPending: 0,
    totalFlagged: 0,
  };
  const wizardDone = !nextStep.isLoading && (!period || anomalies.length === 0);

  useEffect(() => {
    if (wizardDone) onComplete(totalFlagged > 0);
  }, [wizardDone, totalFlagged, onComplete]);

  if (nextStep.isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (nextStep.isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load the next question.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => nextStep.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!period || anomalies.length === 0) {
    return null;
  }

  const anomaly = anomalies[0];
  const remaining = totalPending + totalFlagged;
  const last = history[history.length - 1];

  function recordAnswer(ruleType: string, undoable: boolean) {
    setHistory((h) => [...h, { anomalyId: anomaly.id, ruleType, undoable }]);
  }

  return (
    <Card key={anomaly.id} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
      <CardHeader>
        <CardTitle>
          {period.companyName} — {period.jobTitle}
        </CardTitle>
        <CardDescription>{anomaly.systemNote}</CardDescription>
        <p className="text-xs text-muted-foreground">
          {remaining} {remaining === 1 ? "item" : "items"} left to review
        </p>
      </CardHeader>
      <CardContent>
        {(anomaly.ruleType === "CONCURRENT_EMPLOYERS" || anomaly.ruleType === "FREELANCE_INDICATION") && (
          <GroupingQuestion
            anomalyId={anomaly.id}
            onAnswered={(isSearchable, answer) => {
              recordAnswer(anomaly.ruleType, answer !== "MULTIPLE_SEPARATE_CLIENTS");
              afterAnswer(isSearchable);
            }}
          />
        )}
        {anomaly.ruleType === "TIMELINE_GAP" && (
          <GapQuestion
            anomalyId={anomaly.id}
            onAnswered={(isSearchable) => {
              recordAnswer(anomaly.ruleType, true);
              afterAnswer(isSearchable);
            }}
          />
        )}
        {anomaly.ruleType === "MISSING_WAGE_RANGE" && (
          <WageQuestion
            periodId={period.id}
            anomalyId={anomaly.id}
            onAnswered={(isSearchable) => {
              recordAnswer(anomaly.ruleType, true);
              afterAnswer(isSearchable);
            }}
          />
        )}
        {(anomaly.ruleType === "UNUSUAL_JOB_DURATION" ||
          anomaly.ruleType === "CRITICAL_CERT_MISSING" ||
          anomaly.ruleType === "INCOMPLETE_ENTRY") && (
          <ConfirmDenyQuestion
            anomalyId={anomaly.id}
            ruleType={anomaly.ruleType}
            onAnswered={(isSearchable) => {
              recordAnswer(anomaly.ruleType, true);
              afterAnswer(isSearchable);
            }}
          />
        )}
      </CardContent>
      <CardFooter className="justify-between">
        {last?.undoable ? (
          <Button
            variant="ghost"
            size="sm"
            loading={undo.isPending}
            loadingText="Going back…"
            onClick={() => undo.mutate({ anomalyId: last.anomalyId })}
          >
            ← Back
          </Button>
        ) : (
          <span />
        )}
        <Button variant="ghost" size="sm" onClick={onManualEntry}>
          Made a mistake? Fix this entry manually
        </Button>
      </CardFooter>
    </Card>
  );
}
