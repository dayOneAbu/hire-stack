"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, CheckCircle2, Clock } from "lucide-react";

function ProfileStatusCard() {
  const status = trpc.candidate.resume.status.useQuery();
  const nextStep = trpc.candidate.wizard.getNextStep.useQuery(undefined, {
    enabled: status.data?.parseStatus === "PARSED",
  });

  if (status.isLoading) return <Skeleton className="h-24 w-full" />;

  if (status.data?.parseStatus !== "PARSED" || (nextStep.data && nextStep.data.totalPending > 0)) {
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

  if (status.data.isSearchable) {
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
    onError: (e) => toast.error(e.message),
  });
  const save = trpc.candidate.jobs.save.useMutation({
    onSuccess: () => utils.candidate.jobs.savedList.invalidate(),
  });
  const unsave = trpc.candidate.jobs.unsave.useMutation({
    onSuccess: () => utils.candidate.jobs.savedList.invalidate(),
  });

  if (matched.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!matched.data?.length) {
    return <p className="text-sm text-muted-foreground">No open roles match your profile yet.</p>;
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
                <Badge variant="secondary">{overallScore}% match</Badge>
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

function MyApplications() {
  const applications = trpc.candidate.jobs.myApplications.useQuery();

  if (applications.isLoading) return <Skeleton className="h-24 w-full" />;
  if (!applications.data?.length) {
    return <p className="text-sm text-muted-foreground">No applications yet.</p>;
  }

  return (
    <div className="space-y-2">
      {applications.data.map((app) => (
        <div key={app.id} className="flex items-center justify-between rounded-lg border border-border p-3">
          <span className="text-sm font-medium">{app.jobPost.title}</span>
          <Badge variant="secondary">{app.currentStage}</Badge>
        </div>
      ))}
    </div>
  );
}

function SavedJobs() {
  const saved = trpc.candidate.jobs.savedList.useQuery();

  if (saved.isLoading) return <Skeleton className="h-24 w-full" />;
  if (!saved.data?.length) {
    return <p className="text-sm text-muted-foreground">No saved jobs yet.</p>;
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
