"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function NewJobPostPage() {
  const router = useRouter();
  const industries = trpc.employer.industry.list.useQuery();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [industryId, setIndustryId] = useState<string>("");
  const [rateMin, setRateMin] = useState("");
  const [rateMax, setRateMax] = useState("");
  const [hoursMin, setHoursMin] = useState("20");

  const create = trpc.employer.jobPost.create.useMutation({
    onSuccess: () => {
      toast.success("Job post created");
      router.push("/jobs");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6 py-10">
      <div>
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Job posts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">New job post</h1>
        <p className="mt-1 text-sm text-muted-foreground">Describe the role — you can edit and activate it later.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role details</CardTitle>
          <CardDescription>What the candidate will be doing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input placeholder="e.g. Transaction Coordinator" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Responsibilities, day-to-day tasks, tools they'll use…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
            />
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
          <CardDescription>Used to filter and score candidate matches.</CardDescription>
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

      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={!title || !description || !industryId || create.isPending}
          onClick={() =>
            create.mutate({
              title,
              description,
              industryId,
              targetRateMin: rateMin ? Number(rateMin) : null,
              targetRateMax: rateMax ? Number(rateMax) : null,
              requiredHoursMin: Number(hoursMin) || 20,
            })
          }
        >
          Create job post
        </Button>
      </div>
    </div>
  );
}
