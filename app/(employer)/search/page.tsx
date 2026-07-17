"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Bookmark, ChevronLeft, ChevronRight, Lock, Search, Trash2, UserPlus } from "lucide-react";

type FullCandidate = Extract<RouterOutputs["employer"]["search"]["candidates"], { mode: "full" }>["results"][number];

function CandidateCard({ candidate, jobPostId }: { candidate: FullCandidate; jobPostId: string }) {
  const addCandidate = trpc.employer.board.addCandidate.useMutation({
    onSuccess: () => toast.success("Added to board"),
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-base">
          {candidate.firstName} {candidate.lastName}
        </CardTitle>
        {candidate.matchScore && (
          <CardDescription className="font-medium text-primary">
            {candidate.matchScore.overallMatchScore}% match
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1.5">
        {candidate.software.map((s) => (
          <Badge key={s.name} variant="secondary">
            {s.name} · {s.proficiency.toLowerCase()}
          </Badge>
        ))}
      </CardContent>
      {jobPostId && (
        <CardFooter className="justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={addCandidate.isPending}
            onClick={() => addCandidate.mutate({ jobPostId, candidateId: candidate.id })}
          >
            <UserPlus className="size-3.5" />
            Add to board
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

export default function SearchPage() {
  const industries = trpc.employer.industry.list.useQuery();
  const jobs = trpc.employer.jobPost.list.useQuery();
  const [industryId, setIndustryId] = useState<string>("");
  const [jobPostId, setJobPostId] = useState<string>("");
  const [page, setPage] = useState(1);

  const results = trpc.employer.search.candidates.useQuery(
    { industryId, jobPostId: jobPostId || undefined, page },
    { enabled: !!industryId },
  );

  const utils = trpc.useUtils();
  const savedSearches = trpc.employer.savedSearch.list.useQuery();
  const saveSearch = trpc.employer.savedSearch.save.useMutation({
    onSuccess: () => {
      toast.success("Search saved");
      utils.employer.savedSearch.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteSearch = trpc.employer.savedSearch.delete.useMutation({
    onSuccess: () => utils.employer.savedSearch.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  function recallSearch(filters: Record<string, unknown>) {
    if (typeof filters.industryId === "string") setIndustryId(filters.industryId);
    setPage(1);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Search candidates</h1>
          <p className="mt-1 text-sm text-muted-foreground">Filter by industry and optionally score against a job post.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!industryId || saveSearch.isPending}
            onClick={() => {
              const name = window.prompt("Name this search");
              if (name) saveSearch.mutate({ name, filters: { industryId, jobPostId: jobPostId || undefined } });
            }}
          >
            <Bookmark className="size-3.5" />
            Save this search
          </Button>
          {!!savedSearches.data?.length && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    Saved searches
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {savedSearches.data.map((s) => {
                  const filters = s.filters as Record<string, unknown>;
                  return (
                    <DropdownMenuItem key={s.id} onClick={() => recallSearch(filters)}>
                      <span className="flex-1 truncate">{typeof filters.name === "string" ? filters.name : "Untitled"}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSearch.mutate({ savedSearchId: s.id });
                        }}
                        className="ml-2 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row">
        <Select
          items={industries.data?.map((i) => ({ value: i.id, label: i.name })) ?? []}
          value={industryId}
          onValueChange={(v) => {
            setIndustryId(v ?? "");
            setPage(1);
          }}
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

        <Select
          items={jobs.data?.map((j) => ({ value: j.id, label: j.title })) ?? []}
          value={jobPostId}
          onValueChange={(v) => setJobPostId(v ?? "")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Score against a job post (optional)" />
          </SelectTrigger>
          <SelectContent>
            {jobs.data?.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!industryId && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Search className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Select an industry to start searching</p>
        </div>
      )}

      {results.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {results.data?.mode === "preview" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {results.data.count} candidate{results.data.count === 1 ? "" : "s"} match — get approved and subscribed to
            see full profiles.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.data.sampleCards.map((card, i) => (
              <Card key={i} className="relative overflow-hidden opacity-70">
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
                  <Lock className="size-5 text-muted-foreground" />
                </div>
                <CardHeader>
                  <CardTitle className="text-base">Candidate profile</CardTitle>
                  <CardDescription>{card.rateRangeBucket}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {card.topTags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {results.data?.mode === "full" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {results.data.total} candidates
            {!jobPostId && " — select a job post above to add candidates to its board"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.data.results.map((c) => (
              <CandidateCard key={c.id} candidate={c} jobPostId={jobPostId} />
            ))}
          </div>
        </div>
      )}

      {results.data && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="size-3.5" />
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
            Next
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
