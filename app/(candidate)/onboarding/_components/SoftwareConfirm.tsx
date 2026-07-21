"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SoftwareConfirm({ onDone }: { onDone: () => void }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const list = trpc.candidate.software.list.useQuery();
  const utils = trpc.useUtils();
  const confirm = trpc.candidate.software.confirm.useMutation({
    onSuccess: () => {
      setPendingId(null);
      void utils.candidate.software.list.invalidate();
    },
    onError: (e) => {
      setPendingId(null);
      toast.error(e.message || "Couldn't update that. Try again.");
    },
  });
  const completeOnboarding = trpc.candidate.software.completeOnboarding.useMutation({
    onSuccess: onDone,
    onError: (e) => toast.error(e.message || "Couldn't finish onboarding. Try again."),
  });

  if (list.isLoading) return <Skeleton className="h-40 w-full" />;

  if (list.isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load your software list.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => list.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const items = list.data ?? [];

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No software detected</CardTitle>
          <CardDescription>Nothing to confirm here.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            onClick={() => completeOnboarding.mutate()}
            loading={completeOnboarding.isPending}
            loadingText="Finishing…"
          >
            Continue
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirm your software experience</CardTitle>
        <CardDescription>
          {`We detected ${items.length} ${items.length === 1 ? "tool" : "tools"} on your resume. Remove any that aren't right.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div
            key={item.softwareId}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
          >
            <span className="truncate text-sm font-medium">{item.software.name}</span>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={confirm.isPending && pendingId !== item.softwareId}
              loading={confirm.isPending && pendingId === item.softwareId}
              loadingText="Removing…"
              onClick={() => {
                setPendingId(item.softwareId);
                confirm.mutate({ softwareId: item.softwareId, used: false });
              }}
            >
              Not accurate
            </Button>
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button onClick={() => completeOnboarding.mutate()} loading={completeOnboarding.isPending} loadingText="Finishing…">
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}
