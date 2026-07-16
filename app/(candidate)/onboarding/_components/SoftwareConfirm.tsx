"use client";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SoftwareConfirm({ onDone }: { onDone: () => void }) {
  const list = trpc.candidate.software.list.useQuery();
  const utils = trpc.useUtils();
  const confirm = trpc.candidate.software.confirm.useMutation({
    onSuccess: () => utils.candidate.software.list.invalidate(),
  });

  if (list.isLoading) return <Skeleton className="h-40 w-full" />;

  const items = list.data ?? [];

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No software detected</CardTitle>
          <CardDescription>Nothing to confirm here.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={onDone}>Continue</Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirm your software experience</CardTitle>
        <CardDescription>We detected these tools on your resume. Remove any that aren&apos;t right.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.softwareId} className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">{item.software.name}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={confirm.isPending}
              onClick={() => confirm.mutate({ softwareId: item.softwareId, used: false })}
            >
              Not accurate
            </Button>
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button onClick={onDone}>Continue</Button>
      </CardFooter>
    </Card>
  );
}
