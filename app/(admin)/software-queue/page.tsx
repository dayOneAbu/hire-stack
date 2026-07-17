"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PackageSearch } from "lucide-react";

export default function SoftwareQueuePage() {
  const queue = trpc.admin.softwareQueue.list.useQuery();
  const utils = trpc.useUtils();
  const approve = trpc.admin.softwareQueue.approve.useMutation({
    onSuccess: () => utils.admin.softwareQueue.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const merge = trpc.admin.softwareQueue.merge.useMutation({
    onSuccess: () => {
      toast.success("Merged");
      utils.admin.softwareQueue.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({});

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Software queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve AI-suggested software/tools, or merge duplicates into an existing entry.
        </p>
      </div>

      {queue.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {queue.isError && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load the software queue.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => queue.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {queue.data?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <PackageSearch className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Queue is empty</p>
        </div>
      )}

      <div className="space-y-3">
        {queue.data?.map((s) => {
          const others = queue.data.filter((o) => o.id !== s.id && o.industryId === s.industryId);
          return (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="text-base">{s.name}</CardTitle>
                <CardDescription>{s.industry.name}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => approve.mutate({ softwareId: s.id })} disabled={approve.isPending}>
                  Approve
                </Button>
                <Select
                  items={others.map((o) => ({ value: o.id, label: o.name }))}
                  value={mergeTarget[s.id] ?? null}
                  onValueChange={(v) => setMergeTarget((m) => ({ ...m, [s.id]: v ?? "" }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Merge into..." />
                  </SelectTrigger>
                  <SelectContent>
                    {others.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!mergeTarget[s.id] || merge.isPending}
                  onClick={() => merge.mutate({ softwareId: s.id, intoId: mergeTarget[s.id] })}
                >
                  Merge
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
