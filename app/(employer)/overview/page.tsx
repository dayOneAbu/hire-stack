"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeFilter, rangeToDates, type DateRangeKey } from "@/components/ui/date-range-filter";
import { ListPagination } from "@/components/ui/list-controls";
import { useListControls } from "@/lib/useListControls";
import { Briefcase, KanbanSquare, Users, Calendar, FileCheck, Plus } from "lucide-react";

const REFETCH_INTERVAL_MS = 15_000;

const STAGE_LABELS: Record<string, string> = {
  INBOX: "Inbox",
  SCREENING: "Screening",
  TECHNICAL_ASSESSMENT: "Technical",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

const STAGE_ORDER = Object.keys(STAGE_LABELS);

export default function DashboardPage() {
  const [range, setRange] = useState<DateRangeKey>("30d");
  const dateInput = useMemo(() => rangeToDates(range), [range]);
  const summary = trpc.employer.dashboard.summary.useQuery(dateInput, {
    refetchInterval: REFETCH_INTERVAL_MS,
  });
  const activityList = useListControls(summary.data?.recentActivity ?? [], (a, b, dir) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return dir === "desc" ? -diff : diff;
  });

  if (summary.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 p-6 py-10">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!summary.data || summary.data.stats.activeJobs + summary.data.jobsByStatus.reduce((s, j) => s + j.count, 0) === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6 py-10">
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Briefcase className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">No job posts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first posting to see hiring analytics here.</p>
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

  const { stats, stages, recentActivity, activePipelineJobs } = summary.data;
  const stageMax = Math.max(1, ...stages.map((s) => s.count));

  const tiles = [
    { label: "Active jobs", value: stats.activeJobs, icon: Briefcase, href: "/jobs?status=ACTIVE" },
    { label: "Candidates in pipeline", value: stats.totalCandidates, icon: Users, href: "/board" },
    { label: "In interview", value: stats.interviewing, icon: Calendar, href: "/board" },
    { label: "Offers out", value: stats.offersOut, icon: FileCheck, href: "/board" },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your hiring activity at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter value={range} onChange={setRange} />
          <Link
            href="/board"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <KanbanSquare className="size-4" />
            Open board
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 pt-6">
                <t.icon className="size-5 shrink-0 text-primary" />
                <div>
                  <p className="text-2xl font-semibold text-foreground">{t.value}</p>
                  <p className="text-xs text-muted-foreground">{t.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline by stage</CardTitle>
        </CardHeader>
        <CardContent>
          {stages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No candidates in any pipeline yet.</p>
          ) : (
            <div className="flex items-end gap-3 overflow-x-auto pb-1">
              {STAGE_ORDER.filter((s) => stages.some((st) => st.stage === s)).map((stageKey) => {
                const s = stages.find((st) => st.stage === stageKey)!;
                const bar = (
                  <div className="flex w-20 shrink-0 flex-col items-center gap-1">
                    <div className="flex h-16 w-full items-end">
                      <div
                        className="w-full rounded-t bg-primary/70"
                        style={{ height: `${(s.count / stageMax) * 100}%` }}
                        title={`${s.count} in ${STAGE_LABELS[s.stage]}`}
                      />
                    </div>
                    <span className="text-xs font-medium text-foreground">{s.count}</span>
                    <span className="text-center text-[10px] leading-tight text-muted-foreground">
                      {STAGE_LABELS[s.stage]}
                    </span>
                  </div>
                );
                return s.topJobPostId ? (
                  <Link key={s.stage} href={`/board/${s.topJobPostId}`} className="hover:opacity-80">
                    {bar}
                  </Link>
                ) : (
                  <div key={s.stage}>{bar}</div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active boards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {activePipelineJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active job posts.</p>
            ) : (
              activePipelineJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/board/${job.id}`}
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-accent"
                >
                  <span className="truncate text-foreground">{job.title}</span>
                  <KanbanSquare className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stage changes in this range.</p>
            ) : (
              <>
                {activityList.pageItems.map((a) => (
                  <Link
                    key={a.id}
                    href={`/board/${a.jobPostId}`}
                    className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-accent"
                  >
                    <span className="truncate text-foreground">
                      {a.candidateName} <span className="text-muted-foreground">→ {STAGE_LABELS[a.toStage]}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{a.jobTitle}</span>
                  </Link>
                ))}
                <ListPagination
                  page={activityList.page}
                  totalPages={activityList.totalPages}
                  total={activityList.total}
                  onPageChange={activityList.setPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
