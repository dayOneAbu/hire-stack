"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListToolbar, ListPagination } from "@/components/ui/list-controls";
import { useListControls } from "@/lib/useListControls";

export default function IndustryQueuePage() {
  const queue = trpc.admin.industryQueue.list.useQuery();
  const list = useListControls(queue.data ?? [], (a, b, dir) => {
    const diff = a.name.localeCompare(b.name);
    return dir === "desc" ? -diff : diff;
  });
  const utils = trpc.useUtils();
  const approve = trpc.admin.industryQueue.approve.useMutation({
    onSuccess: () => utils.admin.industryQueue.list.invalidate(),
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const merge = trpc.admin.industryQueue.merge.useMutation({
    onSuccess: () => {
      toast.success("Merged");
      utils.admin.industryQueue.list.invalidate();
      setMergeConfirm(null);
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({});
  const [mergeConfirm, setMergeConfirm] = useState<{ id: string; intoId: string; name: string; intoName: string } | null>(null);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Industry queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve AI-suggested industries, or merge duplicates into an existing entry.
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
          <p className="text-sm text-muted-foreground">Couldn&apos;t load the industry queue.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => queue.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {queue.data?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Building2 className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Queue is empty</p>
        </div>
      )}

      {!!queue.data?.length && (
        <ListToolbar
          sortDir={list.sortDir}
          onSortDirChange={list.setSortDir}
          sortLabel="Name"
          descLabel="Z-A"
          ascLabel="A-Z"
        />
      )}

      <div className="space-y-3">
        {list.pageItems.map((i) => {
          const others = (queue.data ?? []).filter((o) => o.id !== i.id);
          return (
            <Card key={i.id}>
              <CardHeader>
                <CardTitle className="text-base">{i.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => approve.mutate({ industryId: i.id })} disabled={approve.isPending}>
                  Approve
                </Button>
                <Select
                  items={others.map((o) => ({ value: o.id, label: o.name }))}
                  value={mergeTarget[i.id] ?? null}
                  onValueChange={(v) => setMergeTarget((m) => ({ ...m, [i.id]: v ?? "" }))}
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
                  disabled={!mergeTarget[i.id] || merge.isPending}
                  onClick={() => {
                    const intoId = mergeTarget[i.id];
                    const intoName = others.find((o) => o.id === intoId)?.name ?? "";
                    setMergeConfirm({ id: i.id, intoId, name: i.name, intoName });
                  }}
                >
                  Merge
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ListPagination page={list.page} totalPages={list.totalPages} total={list.total} onPageChange={list.setPage} />

      <ConfirmDialog
        open={mergeConfirm !== null}
        onOpenChange={(open) => !open && setMergeConfirm(null)}
        title="Merge industry entries?"
        description={`Merge "${mergeConfirm?.name}" into "${mergeConfirm?.intoName}"? This can't be undone.`}
        confirmLabel="Merge"
        pending={merge.isPending}
        onConfirm={() => mergeConfirm && merge.mutate({ industryId: mergeConfirm.id, intoId: mergeConfirm.intoId })}
      />
    </div>
  );
}
