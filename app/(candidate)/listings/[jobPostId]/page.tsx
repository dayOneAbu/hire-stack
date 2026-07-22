"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Bookmark, BookmarkCheck } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/utils";
import { JobCard } from "../../_components/job-card";

function OtherJobsSidebar({ jobPostId }: { jobPostId: string }) {
  const other = trpc.candidate.jobs.byWorkspace.useQuery({ jobPostId });

  if (other.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (!other.data?.length) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-foreground">More from this employer</h2>
      <div className="space-y-2">
        {other.data.map((jobPost) => (
          <Link
            key={jobPost.id}
            href={`/listings/${jobPost.id}`}
            className="block rounded-lg border border-border p-3 text-sm transition-colors hover:bg-accent"
          >
            <p className="line-clamp-1 font-medium text-foreground">{jobPost.title}</p>
            <p className="line-clamp-2 mt-1 text-xs text-muted-foreground">{jobPost.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SimilarJobs({ jobPostId }: { jobPostId: string }) {
  const similar = trpc.candidate.jobs.similarByJob.useQuery({ jobPostId });
  const saved = trpc.candidate.jobs.savedList.useQuery();
  const utils = trpc.useUtils();
  const savedIds = new Set((saved.data ?? []).map((j) => j.id));

  const apply = trpc.candidate.jobs.applyToJob.useMutation({
    onSuccess: () => {
      toast.success("Applied");
      utils.candidate.jobs.myApplications.invalidate();
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const save = trpc.candidate.jobs.save.useMutation({
    onSuccess: () => utils.candidate.jobs.savedList.invalidate(),
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const unsave = trpc.candidate.jobs.unsave.useMutation({
    onSuccess: () => utils.candidate.jobs.savedList.invalidate(),
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });

  if (similar.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  if (!similar.data?.length) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-foreground">Similar jobs</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {similar.data.map(({ jobPost, similarity }) => (
          <JobCard
            key={jobPost.id}
            jobPost={jobPost}
            badge={<Badge variant="secondary">{Math.round(similarity * 100)}% match</Badge>}
            isSaved={savedIds.has(jobPost.id)}
            saveMutating={save.isPending || unsave.isPending}
            onToggleSave={() =>
              savedIds.has(jobPost.id)
                ? unsave.mutate({ jobPostId: jobPost.id })
                : save.mutate({ jobPostId: jobPost.id })
            }
            footer={
              <Button
                size="sm"
                loading={apply.isPending}
                loadingText="Applying…"
                onClick={() => apply.mutate({ jobPostId: jobPost.id })}
              >
                Apply
              </Button>
            }
          />
        ))}
      </div>
    </div>
  );
}

export default function JobDetailPage({ params }: { params: Promise<{ jobPostId: string }> }) {
  const { jobPostId: id } = use(params);
  const utils = trpc.useUtils();
  const job = trpc.candidate.jobs.byId.useQuery({ jobPostId: id });

  const apply = trpc.candidate.jobs.applyToJob.useMutation({
    onSuccess: () => {
      toast.success("Applied");
      utils.candidate.jobs.byId.invalidate({ jobPostId: id });
      utils.candidate.jobs.myApplications.invalidate();
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const save = trpc.candidate.jobs.save.useMutation({
    onSuccess: () => utils.candidate.jobs.byId.invalidate({ jobPostId: id }),
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const unsave = trpc.candidate.jobs.unsave.useMutation({
    onSuccess: () => utils.candidate.jobs.byId.invalidate({ jobPostId: id }),
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Dashboard
      </Link>

      {job.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : job.isError ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load this job.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => job.refetch()}>
            Retry
          </Button>
        </div>
      ) : !job.data ? null : (
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">{job.data.jobPost.title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{job.data.jobPost.workspace.name}</p>
              </div>
              <Badge variant="secondary">{job.data.overallScore.overallMatchScore}% match</Badge>
            </div>

            <p className="whitespace-pre-wrap text-sm text-foreground">{job.data.jobPost.description}</p>

            {!!job.data.jobPost.requiredSkills.length && (
              <div className="flex flex-wrap gap-1.5">
                {job.data.jobPost.requiredSkills.map((s) => (
                  <Badge key={s.skillId} variant="outline">
                    {s.skill.name}
                  </Badge>
                ))}
              </div>
            )}

            {!!job.data.jobPost.requiredSoftware.length && (
              <div className="flex flex-wrap gap-1.5">
                {job.data.jobPost.requiredSoftware.map((s) => (
                  <Badge key={s.softwareId} variant="outline">
                    {s.software.name}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label={job.data.isSaved ? "Unsave" : "Save"}
                disabled={save.isPending || unsave.isPending}
                onClick={() =>
                  job.data.isSaved
                    ? unsave.mutate({ jobPostId: id })
                    : save.mutate({ jobPostId: id })
                }
              >
                {job.data.isSaved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
              </Button>
              {job.data.application ? (
                <Link
                  href={`/applications/${job.data.application.id}`}
                  className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  View application
                </Link>
              ) : (
                <Button
                  size="sm"
                  loading={apply.isPending}
                  loadingText="Applying…"
                  onClick={() => apply.mutate({ jobPostId: id })}
                >
                  Apply
                </Button>
              )}
            </div>
          </div>

          <aside>
            <OtherJobsSidebar jobPostId={id} />
          </aside>
        </div>
      )}

      {job.data && <SimilarJobs jobPostId={id} />}
    </div>
  );
}
