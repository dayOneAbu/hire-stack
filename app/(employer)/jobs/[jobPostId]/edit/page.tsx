"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc, type RouterOutputs } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

type JobPost = RouterOutputs["employer"]["jobPost"]["byId"];

export default function EditJobPostPage({ params }: { params: Promise<{ jobPostId: string }> }) {
  const { jobPostId } = use(params);
  const job = trpc.employer.jobPost.byId.useQuery({ id: jobPostId });

  if (job.isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 p-6 py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (job.isError || !job.data) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center space-y-3 p-6 py-20 text-center">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load this job post.</p>
        <Button variant="outline" size="sm" onClick={() => job.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return <EditForm key={job.data.id} jobPostId={jobPostId} job={job.data} />;
}

function EditForm({ jobPostId, job }: { jobPostId: string; job: JobPost }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const industries = trpc.employer.industry.list.useQuery();

  const [title, setTitle] = useState(job.title);
  const [description, setDescription] = useState(job.description);
  const [industryId, setIndustryId] = useState(job.industryId);
  const [rateMin, setRateMin] = useState(job.targetRateMin?.toString() ?? "");
  const [rateMax, setRateMax] = useState(job.targetRateMax?.toString() ?? "");
  const [hoursMin, setHoursMin] = useState(job.requiredHoursMin.toString());

  const update = trpc.employer.jobPost.update.useMutation({
    onSuccess: () => {
      toast.success("Job post updated");
      utils.employer.jobPost.byId.invalidate({ id: jobPostId });
      utils.employer.jobPost.list.invalidate();
      router.push(`/jobs/${jobPostId}`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6 py-10">
      <div>
        <Link
          href={`/jobs/${jobPostId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {job.title}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Edit job post</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role details</CardTitle>
          <CardDescription>What the candidate will be doing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} />
          </div>

          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Select
              items={industries.data?.map((i) => ({ value: i.id, label: i.name })) ?? []}
              value={industryId}
              onValueChange={(v) => setIndustryId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an industry" />
              </SelectTrigger>
              <SelectContent>
                {industries.data?.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compensation & availability</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Rate min ($/hr)</Label>
              <Input type="number" value={rateMin} onChange={(e) => setRateMin(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Rate max ($/hr)</Label>
              <Input type="number" value={rateMax} onChange={(e) => setRateMax(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Hours/wk min</Label>
              <Input type="number" value={hoursMin} onChange={(e) => setHoursMin(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" render={<Link href={`/jobs/${jobPostId}`} />}>
          Cancel
        </Button>
        <Button
          disabled={!title || !description || !industryId || update.isPending}
          onClick={() =>
            update.mutate({
              id: jobPostId,
              title,
              description,
              industryId,
              targetRateMin: rateMin ? Number(rateMin) : null,
              targetRateMax: rateMax ? Number(rateMax) : null,
              requiredHoursMin: Number(hoursMin) || 20,
            })
          }
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}
