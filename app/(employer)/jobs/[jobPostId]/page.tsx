"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Archive, Copy, KanbanSquare, Pencil } from "lucide-react";

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  EXPIRED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  FILLED: "bg-primary/10 text-primary",
};

export default function JobPostDetailPage({ params }: { params: Promise<{ jobPostId: string }> }) {
  const { jobPostId } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();
  const job = trpc.employer.jobPost.byId.useQuery({ id: jobPostId });
  const activate = trpc.employer.jobPost.activate.useMutation({
    onSuccess: () => utils.employer.jobPost.byId.invalidate({ id: jobPostId }),
    onError: (e) => toast.error(e.message),
  });
  const clone = trpc.employer.jobPost.cloneFrom.useMutation({
    onSuccess: () => toast.success("Cloned to a new draft"),
  });
  const archive = trpc.employer.jobPost.archive.useMutation({
    onSuccess: () => {
      toast.success("Job post archived");
      utils.employer.jobPost.list.invalidate();
      router.push("/jobs");
    },
    onError: (e) => toast.error(e.message),
  });

  if (job.isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6 py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!job.data) return null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 py-10">
      <div>
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Job posts
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{job.data.title}</h1>
          <Badge className={STATUS_TONE[job.data.status] ?? ""} variant="outline">
            {job.data.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {job.data.requiredHoursMin}h/wk min
          {job.data.targetRateMin || job.data.targetRateMax
            ? ` · $${job.data.targetRateMin ?? "?"}–$${job.data.targetRateMax ?? "?"}/hr`
            : ""}
          {job.data.expiresAt ? ` · expires ${new Date(job.data.expiresAt).toLocaleDateString()}` : ""}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Description</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{job.data.description}</p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => archive.mutate({ jobPostId: job.data!.id })} disabled={archive.isPending}>
          <Archive className="size-3.5" />
          Archive
        </Button>
        <Button variant="ghost" render={<Link href={`/jobs/${job.data.id}/edit`} />}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <Button variant="ghost" onClick={() => clone.mutate({ sourceJobPostId: job.data!.id })}>
          <Copy className="size-3.5" />
          Clone
        </Button>
        <Button variant="outline" render={<Link href={`/board/${job.data.id}`} />}>
          <KanbanSquare className="size-3.5" />
          Board
        </Button>
        {job.data.status === "DRAFT" && (
          <Button onClick={() => activate.mutate({ jobPostId: job.data!.id })} disabled={activate.isPending}>
            Activate
          </Button>
        )}
      </div>
    </div>
  );
}
