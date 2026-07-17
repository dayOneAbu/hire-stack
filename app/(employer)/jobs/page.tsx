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
import { toast } from "sonner";
import { Archive, Briefcase, Copy, KanbanSquare, MoreHorizontal, Pencil, Plus } from "lucide-react";

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  EXPIRED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  FILLED: "bg-primary/10 text-primary",
};

export default function JobsPage() {
  const jobs = trpc.employer.jobPost.list.useQuery();
  const utils = trpc.useUtils();
  const activate = trpc.employer.jobPost.activate.useMutation({
    onSuccess: () => utils.employer.jobPost.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const clone = trpc.employer.jobPost.cloneFrom.useMutation({
    onSuccess: () => utils.employer.jobPost.list.invalidate(),
  });
  const archive = trpc.employer.jobPost.archive.useMutation({
    onSuccess: () => {
      toast.success("Job post archived");
      utils.employer.jobPost.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
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

      {jobs.data?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Briefcase className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">No job posts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first posting to start building a pipeline.</p>
          <Button className="mt-4" render={<Link href="/jobs/new" />}>
            <Plus className="size-4" />
            New job post
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {jobs.data?.map((job) => (
          <Card key={job.id} className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link href={`/jobs/${job.id}`} className="truncate transition-colors hover:text-primary">
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
              {job.description.length > 160 && (
                <Link href={`/jobs/${job.id}`} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                  Read more
                </Link>
              )}
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t-0 bg-transparent pt-0">
              <Button variant="outline" size="sm" render={<Link href={`/board/${job.id}`} />}>
                <KanbanSquare className="size-3.5" />
                Board
              </Button>
              {job.status === "DRAFT" && (
                <Button size="sm" onClick={() => activate.mutate({ jobPostId: job.id })} disabled={activate.isPending}>
                  Activate
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
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => archive.mutate({ jobPostId: job.id })}
                  >
                    <Archive className="size-3.5" />
                    Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
