"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, CheckCircle2, Clock, Inbox, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { getSafeErrorMessage } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function ProfileStatusCard() {
  const status = trpc.candidate.resume.status.useQuery();
  // Resume parsing is still in flight (AI extraction pending) — the only state that's actually
  // gated on parseStatus rather than the FRS §16 isSearchable/anomaly signal below.
  const isParsing = status.data?.parseStatus === "PENDING" || status.data?.parseStatus === "FAILED";
  const nextStep = trpc.candidate.wizard.getNextStep.useQuery(undefined, {
    enabled: !!status.data && !isParsing,
  });

  if (status.isLoading) return <Skeleton className="h-24 w-full" />;

  if (status.isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load your profile status.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => status.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (isParsing || (nextStep.data && nextStep.data.totalPending > 0)) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Finish setting up your profile</CardTitle>
          <CardDescription>Complete onboarding to become visible to employers.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button render={<Link href="/onboarding" />}>Continue onboarding</Button>
        </CardFooter>
      </Card>
    );
  }

  if (status.data!.isSearchable) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center gap-3 pt-6">
          <CheckCircle2 className="size-6 text-primary" />
          <div>
            <p className="font-medium">You&apos;re all set</p>
            <p className="text-sm text-muted-foreground">Your profile is verified and visible to employers.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="flex items-center gap-3 pt-6">
        <Clock className="size-6 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-medium">Waiting on admin review</p>
          <p className="text-sm text-muted-foreground">
            We&apos;ll email you once your profile is cleared to go live.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function MatchedJobs() {
  const matched = trpc.candidate.jobs.matched.useQuery();
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

  if (matched.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  if (matched.isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load matched jobs.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => matched.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!matched.data?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
        <Search className="size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground">No matches yet</p>
        <p className="mt-1 text-sm text-muted-foreground">No open roles match your profile yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {matched.data.map(({ jobPost, overallScore }) => {
        const isSaved = savedIds.has(jobPost.id);
        return (
          <Card key={jobPost.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{jobPost.title}</span>
                <Badge variant="secondary">{overallScore.overallMatchScore}% match</Badge>
              </CardTitle>
              <CardDescription className="line-clamp-2">{jobPost.description}</CardDescription>
            </CardHeader>
            <CardFooter className="justify-between">
              <Button
                variant="ghost"
                size="icon"
                aria-label={isSaved ? "Unsave" : "Save"}
                onClick={() =>
                  isSaved ? unsave.mutate({ jobPostId: jobPost.id }) : save.mutate({ jobPostId: jobPost.id })
                }
              >
                {isSaved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
              </Button>
              <Button
                size="sm"
                loading={apply.isPending}
                loadingText="Applying…"
                onClick={() => apply.mutate({ jobPostId: jobPost.id })}
              >
                Apply
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

function RecommendedJobs() {
  const recommended = trpc.candidate.jobs.recommended.useQuery();

  if (recommended.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (recommended.isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load recommendations.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => recommended.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!recommended.data?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
        <Sparkles className="size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground">No recommendations yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Finish your profile so we can match you against open roles.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {recommended.data.map(({ jobPost, similarity }) => (
        <Card key={jobPost.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>{jobPost.title}</span>
              <Badge variant="secondary">{Math.round(similarity * 100)}% fit</Badge>
            </CardTitle>
            <CardDescription className="line-clamp-2">{jobPost.description}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function MyApplications() {
  const utils = trpc.useUtils();
  const [withdrawTarget, setWithdrawTarget] = useState<{ id: string; title: string } | null>(null);
  const applications = trpc.candidate.jobs.myApplications.useQuery();
  const withdraw = trpc.candidate.jobs.withdraw.useMutation({
    onSuccess: () => {
      toast.success("Application withdrawn");
      utils.candidate.jobs.myApplications.invalidate();
      setWithdrawTarget(null);
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });

  if (applications.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (applications.isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load your applications.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => applications.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!applications.data?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
        <Inbox className="size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground">No applications yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Apply to a matched job to see it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {applications.data.map((app) => {
        const canWithdraw = app.currentStage === "INBOX" && app.source === "CANDIDATE_APPLIED";
        return (
          <div
            key={app.id}
            className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted"
          >
            <Link href={`/applications/${app.id}`} className="flex flex-1 items-center justify-between">
              <span className="text-sm font-medium">{app.jobPost.title}</span>
              <Badge variant="secondary" className="mr-2">
                {app.currentStage}
              </Badge>
            </Link>
            {canWithdraw ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={withdraw.isPending}
                onClick={() => setWithdrawTarget({ id: app.id, title: app.jobPost.title })}
              >
                Withdraw
              </Button>
            ) : (
              <span className="ml-2 shrink-0 text-xs text-muted-foreground">Contact the employer to withdraw</span>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={withdrawTarget !== null}
        onOpenChange={(open) => !open && setWithdrawTarget(null)}
        title="Withdraw this application?"
        description={`Withdraw your application for "${withdrawTarget?.title}"? This can't be undone.`}
        confirmLabel="Withdraw"
        pending={withdraw.isPending}
        onConfirm={() => withdrawTarget && withdraw.mutate({ applicationId: withdrawTarget.id })}
      />
    </div>
  );
}

function SavedJobs() {
  const saved = trpc.candidate.jobs.savedList.useQuery();

  if (saved.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (saved.isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load saved jobs.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => saved.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!saved.data?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
        <Bookmark className="size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground">No saved jobs yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Bookmark a matched job to keep track of it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {saved.data.map((jobPost) => (
        <div key={jobPost.id} className="flex items-center justify-between rounded-lg border border-border p-3">
          <span className="text-sm font-medium">{jobPost.title}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-6 py-10">
      <ProfileStatusCard />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Matched jobs</h2>
        <MatchedJobs />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Recommended for you</h2>
        <RecommendedJobs />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">My applications</h2>
        <MyApplications />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Saved jobs</h2>
        <SavedJobs />
      </section>
    </div>
  );
}
