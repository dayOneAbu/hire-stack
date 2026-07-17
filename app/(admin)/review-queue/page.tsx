"use client";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

function SimilarAnomalies({ anomalyId }: { anomalyId: string }) {
  const similar = trpc.admin.reviewQueue.similarAnomalies.useQuery({ anomalyId });

  if (similar.isLoading) return <Skeleton className="h-16 w-full" />;
  if (similar.isError || !similar.data?.length) return null;

  return (
    <div className="w-full space-y-2 rounded-lg border border-dashed border-border bg-muted/40 p-3">
      <p className="text-xs font-medium text-foreground">Similar past cases</p>
      {similar.data.map((s) => (
        <div key={s.id} className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{Math.round(s.similarity * 100)}% similar</span>{" "}
          ({s.status.replace(/_/g, " ").toLowerCase()}) — {s.systemNote}
          {s.candidateAnswer && <> · candidate said: &quot;{s.candidateAnswer}&quot;</>}
        </div>
      ))}
    </div>
  );
}

export default function ReviewQueuePage() {
  const queue = trpc.admin.reviewQueue.list.useQuery();
  const utils = trpc.useUtils();
  const resolve = trpc.admin.reviewQueue.resolve.useMutation({
    onSuccess: () => {
      toast.success("Resolved");
      utils.admin.reviewQueue.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Review queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Employment anomalies candidates flagged as "not sure" — resolving flips the candidate's
          searchable status automatically once all their open anomalies clear.
        </p>
      </div>

      {queue.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {queue.isError && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load the review queue.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => queue.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {queue.data?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Nothing flagged for review</p>
        </div>
      )}

      <div className="space-y-3">
        {queue.data?.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {a.employmentPeriod.candidate.firstName} {a.employmentPeriod.candidate.lastName} —{" "}
                {a.ruleType}
              </CardTitle>
              <CardDescription>{a.systemNote}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => resolve.mutate({ anomalyId: a.id, status: "OVERRIDDEN_BY_ADMIN" })}
                  disabled={resolve.isPending}
                >
                  Override & resolve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resolve.mutate({ anomalyId: a.id, status: "IGNORED" })}
                  disabled={resolve.isPending}
                >
                  Ignore
                </Button>
              </div>
              <SimilarAnomalies anomalyId={a.id} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
