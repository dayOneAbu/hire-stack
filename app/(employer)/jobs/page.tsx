"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListToolbar, ListPagination } from "@/components/ui/list-controls";
import { DateRangeFilter, rangeToDates, type DateRangeKey } from "@/components/ui/date-range-filter";
import { useListControls } from "@/lib/useListControls";
import { toast } from "sonner";
import { Archive, Briefcase, CalendarPlus, Copy, KanbanSquare, MoreHorizontal, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { getSafeErrorMessage } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const ALL_STATUSES = "__all__";

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  PAUSED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  EXPIRED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  FILLED: "bg-primary/10 text-primary",
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Mirrors the one-time-only rule in jobPost.extend: already extended once the
// current window is longer than the original activatedAt + 30d.
function alreadyExtended(job: { activatedAt: Date | string | null; expiresAt: Date | string | null }) {
  if (!job.activatedAt || !job.expiresAt) return false;
  const originalExpiry = new Date(job.activatedAt).getTime() + THIRTY_DAYS_MS;
  return new Date(job.expiresAt).getTime() > originalExpiry;
}

export default function JobsPage() {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; title: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);
  const [range, setRange] = useState<DateRangeKey>("all");
  const jobs = trpc.employer.jobPost.list.useQuery();
  const utils = trpc.useUtils();

  const filtered = useMemo(() => {
    const { from } = rangeToDates(range);
    return (jobs.data ?? []).filter(
      (j) =>
        (statusFilter === ALL_STATUSES || j.status === statusFilter) && (!from || new Date(j.createdAt) >= from),
    );
  }, [jobs.data, statusFilter, range]);
  const list = useListControls(filtered, (a, b, dir) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return dir === "desc" ? -diff : diff;
  });
  const activate = trpc.employer.jobPost.activate.useMutation({
    onSuccess: () => utils.employer.jobPost.list.invalidate(),
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const clone = trpc.employer.jobPost.cloneFrom.useMutation({
    onSuccess: () => utils.employer.jobPost.list.invalidate(),
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const archive = trpc.employer.jobPost.archive.useMutation({
    onSuccess: () => {
      toast.success("Job post archived");
      utils.employer.jobPost.list.invalidate();
      setArchiveTarget(null);
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const pause = trpc.employer.jobPost.pause.useMutation({
    onSuccess: () => utils.employer.jobPost.list.invalidate(),
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const resume = trpc.employer.jobPost.resume.useMutation({
    onSuccess: () => utils.employer.jobPost.list.invalidate(),
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const extend = trpc.employer.jobPost.extend.useMutation({
    onSuccess: () => {
      toast.success("Job post extended 30 days");
      utils.employer.jobPost.list.invalidate();
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const deleteDraft = trpc.employer.jobPost.deleteDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft deleted");
      utils.employer.jobPost.list.invalidate();
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Job posts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage postings and move candidates through your pipeline.</p>
        </div>
        <Button render={<Link href="/jobs/new" />}>
          <Plus className="size-4" />
          New job post
        </Button>
      </div>

      {jobs.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {jobs.isError && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load job posts.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => jobs.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!!jobs.data?.length && (
        <ListToolbar
          sortDir={list.sortDir}
          onSortDirChange={list.setSortDir}
          sortLabel="Created"
          right={
            <>
              <DateRangeFilter value={range} onChange={setRange} />
              <Select
                items={[
                  { value: ALL_STATUSES, label: "All statuses" },
                  ...Object.keys(STATUS_TONE).map((s) => ({ value: s, label: s })),
                ]}
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v ?? ALL_STATUSES)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
                  {Object.keys(STATUS_TONE).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
        />
      )}

      {jobs.data?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Briefcase className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">No job posts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first posting to start building a pipeline.</p>
          <Button className="mt-4" render={<Link href="/jobs/new" />}>
            <Plus className="size-4" />
            New job post
          </Button>
          <p className="mt-6 text-xs text-muted-foreground">
            Drafts are free —{" "}
            <Link href="/settings/billing" className="font-medium text-primary hover:underline">
              subscribe to activate
            </Link>{" "}
            your first posting.
          </p>
        </div>
      )}

      {!!jobs.data?.length && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm text-muted-foreground">No job posts match that status.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {list.pageItems.map((job) => (
          <Card key={job.id} className="relative transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link href={`/jobs/${job.id}`} className="truncate after:absolute after:inset-0 hover:text-primary">
                  {job.title}
                </Link>
                <Badge className={STATUS_TONE[job.status] ?? ""} variant="outline">
                  {job.status}
                </Badge>
              </CardTitle>
              <CardDescription>
                {job.requiredHoursMin}h/wk min
                {job.expiresAt ? ` · expires ${new Date(job.expiresAt).toLocaleDateString()}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="line-clamp-3 text-sm text-muted-foreground">{job.description}</p>
            </CardContent>
            <CardFooter className="relative z-10 justify-end gap-2 border-t-0 bg-transparent pt-0">
              <Button variant="outline" size="sm" render={<Link href={`/board/${job.id}`} />}>
                <KanbanSquare className="size-3.5" />
                Board
              </Button>
              {job.status === "DRAFT" && (
                <Button size="sm" onClick={() => activate.mutate({ jobPostId: job.id })} disabled={activate.isPending}>
                  Activate
                </Button>
              )}
              {job.status === "ACTIVE" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pause.mutate({ jobPostId: job.id })}
                  disabled={pause.isPending}
                >
                  <Pause className="size-3.5" />
                  Pause
                </Button>
              )}
              {job.status === "PAUSED" && (
                <Button size="sm" onClick={() => resume.mutate({ jobPostId: job.id })} disabled={resume.isPending}>
                  <Play className="size-3.5" />
                  Resume
                </Button>
              )}
              {job.status === "ACTIVE" && !alreadyExtended(job) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => extend.mutate({ jobPostId: job.id })}
                  disabled={extend.isPending}
                >
                  <CalendarPlus className="size-3.5" />
                  Extend
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon" aria-label="More actions">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem render={<Link href={`/jobs/${job.id}/edit`} />}>
                    <Pencil className="size-3.5" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => clone.mutate({ sourceJobPostId: job.id })}>
                    <Copy className="size-3.5" />
                    Clone
                  </DropdownMenuItem>
                  {job.status === "DRAFT" ? (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteTarget({ id: job.id, title: job.title })}
                    >
                      <Trash2 className="size-3.5" />
                      Delete draft
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setArchiveTarget({ id: job.id, title: job.title })}
                    >
                      <Archive className="size-3.5" />
                      Archive
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardFooter>
          </Card>
        ))}
      </div>

      <ListPagination page={list.page} totalPages={list.totalPages} total={list.total} onPageChange={list.setPage} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this draft?"
        description={`"${deleteTarget?.title}" will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete draft"
        pending={deleteDraft.isPending}
        onConfirm={() => deleteTarget && deleteDraft.mutate({ jobPostId: deleteTarget.id })}
      />
      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title="Archive this job post?"
        description={`"${archiveTarget?.title}" will move out of your active postings. Archived posts are hidden from candidates and can't be reactivated.`}
        confirmLabel="Archive"
        pending={archive.isPending}
        onConfirm={() => archiveTarget && archive.mutate({ jobPostId: archiveTarget.id })}
      />
    </div>
  );
}
