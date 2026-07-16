"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupingQuestion } from "./questions/GroupingQuestion";
import { GapQuestion } from "./questions/GapQuestion";
import { WageQuestion } from "./questions/WageQuestion";
import { ConfirmDenyQuestion } from "./questions/ConfirmDenyQuestion";

export function Wizard({
  onComplete,
  onManualEntry,
}: {
  onComplete: () => void;
  onManualEntry: () => void;
}) {
  const utils = trpc.useUtils();
  const nextStep = trpc.candidate.wizard.getNextStep.useQuery();

  function afterAnswer(isSearchable: boolean) {
    void utils.candidate.wizard.getNextStep.invalidate();
    if (isSearchable) onComplete();
  }

  if (nextStep.isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  const { period, anomalies } = nextStep.data ?? { period: null, anomalies: [] };

  if (!period || anomalies.length === 0) {
    onComplete();
    return null;
  }

  const anomaly = anomalies[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {period.companyName} — {period.jobTitle}
        </CardTitle>
        <CardDescription>{anomaly.systemNote}</CardDescription>
      </CardHeader>
      <CardContent>
        {(anomaly.ruleType === "CONCURRENT_EMPLOYERS" || anomaly.ruleType === "FREELANCE_INDICATION") && (
          <GroupingQuestion anomalyId={anomaly.id} onAnswered={afterAnswer} />
        )}
        {anomaly.ruleType === "TIMELINE_GAP" && (
          <GapQuestion anomalyId={anomaly.id} onAnswered={afterAnswer} />
        )}
        {anomaly.ruleType === "MISSING_WAGE_RANGE" && (
          <WageQuestion periodId={period.id} anomalyId={anomaly.id} onAnswered={afterAnswer} />
        )}
        {(anomaly.ruleType === "UNUSUAL_JOB_DURATION" ||
          anomaly.ruleType === "CRITICAL_CERT_MISSING" ||
          anomaly.ruleType === "INCOMPLETE_ENTRY") && (
          <ConfirmDenyQuestion
            anomalyId={anomaly.id}
            ruleType={anomaly.ruleType}
            onAnswered={afterAnswer}
          />
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="ghost" size="sm" onClick={onManualEntry}>
          Something wrong? Edit this entry manually
        </Button>
      </CardFooter>
    </Card>
  );
}
