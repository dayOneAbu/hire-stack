"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Bookmark, CheckCircle2, Clock, Inbox, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { getSafeErrorMessage } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { JobCard } from "../_components/job-card";

function ProfileStatusCard() {
  const status = trpc.candidate.resume.status.useQuery();
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

  // FRS §16: drive the nag off isSearchable + open PENDING_CANDIDATE anomalies, not parseStatus —
  // a manual-entry candidate (parseStatus: null) with resolved anomalies must not get stuck here.
  if (!status.data!.isSearchable && (isParsing || (nextStep.data?.totalPending ?? 0) > 0)) {
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
            Check back here once your profile is cleared to go live.
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
      {matched.data.map(({ jobPost, overallScore }) => (
        <JobCard
          key={jobPost.id}
          jobPost={jobPost}
          badge={<Badge variant="secondary">{overallScore.overallMatchScore}% match</Badge>}
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
  );
}

function RecommendedJobs() {
  const recommended = trpc.candidate.jobs.recommended.useQuery();
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
        <JobCard
          key={jobPost.id}
          jobPost={jobPost}
          badge={<Badge variant="secondary">{Math.round(similarity * 100)}% fit</Badge>}
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
    <div className="grid gap-4 sm:grid-cols-2">
      {applications.data.map((app) => {
        const canWithdraw = app.currentStage === "INBOX" && app.source === "CANDIDATE_APPLIED";
        return (
          <Card key={app.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <Link href={`/applications/${app.id}`} className="line-clamp-1 hover:underline">
                  {app.jobPost.title}
                </Link>
                <Badge variant="secondary">{app.currentStage}</Badge>
              </CardTitle>
              <p className="line-clamp-1 text-xs font-medium text-muted-foreground">{app.jobPost.workspace.name}</p>
              <CardDescription className="line-clamp-2 min-h-10">{app.jobPost.description}</CardDescription>
            </CardHeader>
            <CardFooter className="justify-end">
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
                <Link
                  href={`/applications/${app.id}`}
                  className="line-clamp-1 ml-auto text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Message the employer to withdraw
                </Link>
              )}
            </CardFooter>
          </Card>
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
  const utils = trpc.useUtils();

  const apply = trpc.candidate.jobs.applyToJob.useMutation({
    onSuccess: () => {
      toast.success("Applied");
      utils.candidate.jobs.myApplications.invalidate();
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const unsave = trpc.candidate.jobs.unsave.useMutation({
    onSuccess: () => utils.candidate.jobs.savedList.invalidate(),
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });

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
    <div className="grid gap-4 sm:grid-cols-2">
      {saved.data.map((jobPost) => (
        <JobCard
          key={jobPost.id}
          jobPost={jobPost}
          isSaved
          saveMutating={unsave.isPending}
          onToggleSave={() => unsave.mutate({ jobPostId: jobPost.id })}
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
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 py-10">
      <ProfileStatusCard />

      <Tabs defaultValue="matched">
        <TabsList className="w-full">
          <TabsTrigger value="matched">Matched</TabsTrigger>
          <TabsTrigger value="recommended">Recommended</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="saved">Saved</TabsTrigger>
        </TabsList>

        <TabsContent value="matched" className="pt-3">
          <MatchedJobs />
        </TabsContent>
        <TabsContent value="recommended" className="pt-3">
          <RecommendedJobs />
        </TabsContent>
        <TabsContent value="applications" className="pt-3">
          <MyApplications />
        </TabsContent>
        <TabsContent value="saved" className="pt-3">
          <SavedJobs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
