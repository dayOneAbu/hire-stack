"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText } from "lucide-react";

const ACTIONS = [
  "USER_LOGIN",
  "USER_SUSPENDED",
  "USER_REINSTATED",
  "PROFILE_PUBLISHED",
  "RESUME_PARSED",
  "STRIPE_WEBHOOK_RECEIVED",
  "JOB_SLOT_EXCEEDED",
  "CANDIDATE_STAGE_TRANSITION",
  "TAXONOMY_MERGED",
] as const;

const ALL_ACTIONS = "__all__";

export default function AuditTrailPage() {
  const [action, setAction] = useState<string>(ALL_ACTIONS);
  const [page, setPage] = useState(1);

  const query = trpc.admin.auditTrail.list.useQuery({
    action: action === ALL_ACTIONS ? undefined : (action as (typeof ACTIONS)[number]),
    page,
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit trail</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every recorded platform action, most recent first.</p>
        </div>
        <Select
          items={[{ value: ALL_ACTIONS, label: "All actions" }, ...ACTIONS.map((a) => ({ value: a, label: a }))]}
          value={action}
          onValueChange={(v) => {
            setAction(v ?? ALL_ACTIONS);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ACTIONS}>All actions</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {query.isError && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load the audit trail.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => query.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {query.data?.entries.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <ScrollText className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">No matching entries</p>
        </div>
      )}

      <div className="space-y-2">
        {query.data?.entries.map((entry) => (
          <Card key={entry.id}>
            <CardContent className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{entry.action}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {entry.user ? `${entry.user.name} (${entry.user.email})` : "System"}
                  {entry.payload ? ` — ${JSON.stringify(entry.payload)}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {query.data && query.data.total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{query.data.total} total entries</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * 50 >= query.data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
