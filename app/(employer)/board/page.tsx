"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeFilter, rangeToDates, type DateRangeKey } from "@/components/ui/date-range-filter";
import { ListPagination } from "@/components/ui/list-controls";
import { useListControls } from "@/lib/useListControls";
import { KanbanSquare, Plus } from "lucide-react";

const REFETCH_INTERVAL_MS = 15_000;

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  PAUSED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  EXPIRED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  FILLED: "bg-primary/10 text-primary",
};

export default function BoardIndexPage() {
  const [range, setRange] = useState<DateRangeKey>("all");
  const jobs = trpc.employer.jobPost.list.useQuery(undefined, { refetchInterval: REFETCH_INTERVAL_MS });
  const { from } = rangeToDates(range);
  const pipelineJobs = (jobs.data ?? []).filter(
    (j) => j.status !== "DRAFT" && (!from || new Date(j.createdAt) >= from),
  );
  const list = useListControls(pipelineJobs, (a, b, dir) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return dir === "desc" ? -diff : diff;
  });

  if (jobs.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 p-6 py-10">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (pipelineJobs.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6 py-10">
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <KanbanSquare className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">No pipelines yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Activate a job post to start tracking candidates on a board.</p>
          <Link
            href="/jobs/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="size-4" />
            New job post
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Board</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pick a job post to view its candidate pipeline.</p>
        </div>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {list.total === 0 && (
        <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No pipelines in this date range.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {list.pageItems.map((job) => (
          <Link key={job.id} href={`/board/${job.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <KanbanSquare className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{job.title}</span>
                  <Badge className={STATUS_TONE[job.status] ?? ""} variant="outline">
                    {job.status}
                  </Badge>
                </CardTitle>
                <CardDescription>{job.requiredHoursMin}h/wk min</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <ListPagination page={list.page} totalPages={list.totalPages} total={list.total} onPageChange={list.setPage} />
    </div>
  );
}
