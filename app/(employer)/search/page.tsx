"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ArrowDownAZ, ArrowUpAZ, Bookmark, ChevronLeft, ChevronRight, Lock, Search, Trash2, UserPlus } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/utils";

const PAGE_SIZE = Number(process.env.NEXT_PUBLIC_PAGE_SIZE_SEARCH ?? 20);
type Proficiency = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

type FullCandidate = Extract<RouterOutputs["employer"]["search"]["candidates"], { mode: "full" }>["results"][number];
type SemanticCandidate = Extract<RouterOutputs["employer"]["search"]["semantic"], { mode: "full" }>["results"][number];

function SemanticCandidateCard({ candidate, jobPostId }: { candidate: SemanticCandidate; jobPostId: string }) {
  const addCandidate = trpc.employer.board.addCandidate.useMutation({
    onSuccess: () => toast.success("Added to board"),
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-base">
          {candidate.firstName} {candidate.lastName}
        </CardTitle>
        <CardDescription>
          {Math.round(candidate.similarity * 100)}% semantic match
          {candidate.matchScore && ` · ${candidate.matchScore.overallMatchScore}% job match`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {candidate.software.map((name) => (
            <Badge key={name} variant="secondary">
              {name}
            </Badge>
          ))}
        </div>
        <div className="rounded-md border border-dashed border-border bg-muted/40 p-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Why this matched ({candidate.matchedChunk.source}):</span>{" "}
          {candidate.matchedChunk.content}
        </div>
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

function CandidateCard({ candidate, jobPostId }: { candidate: FullCandidate; jobPostId: string }) {
  const addCandidate = trpc.employer.board.addCandidate.useMutation({
    onSuccess: () => toast.success("Added to board"),
    onError: (e) => toast.error(getSafeErrorMessage(e)),
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
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [softwareIds, setSoftwareIds] = useState<{ softwareId: string; minProficiency: Proficiency }[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [rateMin, setRateMin] = useState("");
  const [rateMax, setRateMax] = useState("");
  const [minWeeklyAvailability, setMinWeeklyAvailability] = useState("");
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "rate">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const softwareOptions = trpc.employer.industry.software.useQuery(
    { industryId },
    { enabled: !!industryId },
  );
  const skillOptions = trpc.employer.industry.skills.useQuery(
    { industryId },
    { enabled: !!industryId },
  );

  const results = trpc.employer.search.candidates.useQuery(
    {
      industryId,
      jobPostId: jobPostId || undefined,
      page,
      softwareIds: softwareIds.length ? softwareIds : undefined,
      skillIds: skillIds.length ? skillIds : undefined,
      rateMin: rateMin ? Number(rateMin) : undefined,
      rateMax: rateMax ? Number(rateMax) : undefined,
      minWeeklyAvailability: minWeeklyAvailability ? Number(minWeeklyAvailability) : undefined,
      sortBy,
      sortDir,
    },
    { enabled: !!industryId && !activeQuery },
  );

  const semanticResults = trpc.employer.search.semantic.useQuery(
    { query: activeQuery, jobPostId: jobPostId || undefined },
    { enabled: !!activeQuery },
  );

  const utils = trpc.useUtils();
  const savedSearches = trpc.employer.savedSearch.list.useQuery();
  const saveSearch = trpc.employer.savedSearch.save.useMutation({
    onSuccess: () => {
      toast.success("Search saved");
      utils.employer.savedSearch.list.invalidate();
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const deleteSearch = trpc.employer.savedSearch.delete.useMutation({
    onSuccess: () => utils.employer.savedSearch.list.invalidate(),
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });

  function recallSearch(filters: Record<string, unknown>) {
    if (typeof filters.industryId === "string") setIndustryId(filters.industryId);
    setJobPostId(typeof filters.jobPostId === "string" ? filters.jobPostId : "");
    setSoftwareIds(
      Array.isArray(filters.softwareIds)
        ? (filters.softwareIds as { softwareId: string; minProficiency: Proficiency }[])
        : [],
    );
    setSkillIds(Array.isArray(filters.skillIds) ? (filters.skillIds as string[]) : []);
    setRateMin(typeof filters.rateMin === "number" ? String(filters.rateMin) : "");
    setRateMax(typeof filters.rateMax === "number" ? String(filters.rateMax) : "");
    setMinWeeklyAvailability(
      typeof filters.minWeeklyAvailability === "number" ? String(filters.minWeeklyAvailability) : "",
    );
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
            onClick={() => setSaveSearchOpen(true)}
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

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setActiveQuery(queryInput.trim());
        }}
      >
        <Input
          placeholder="Describe who you need, e.g. “VA experienced with property management and QuickBooks”"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
        />
        <Button type="submit" disabled={!queryInput.trim()}>
          <Search className="size-3.5" />
          Search
        </Button>
        {activeQuery && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setQueryInput("");
              setActiveQuery("");
            }}
          >
            Clear
          </Button>
        )}
      </form>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row">
        <Select
          items={jobs.data?.map((j) => ({ value: j.id, label: j.title })) ?? []}
          value={jobPostId}
          onValueChange={(v) => {
            setJobPostId(v ?? "");
            const job = jobs.data?.find((j) => j.id === v);
            if (job) {
              setIndustryId(job.industryId);
              setPage(1);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Search for a job post" />
          </SelectTrigger>
          <SelectContent>
            {jobs.data?.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={industries.data?.map((i) => ({ value: i.id, label: i.name })) ?? []}
          value={industryId}
          onValueChange={(v) => {
            setIndustryId(v ?? "");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={jobPostId ? "Industry" : "...or just pick an industry to browse"} />
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

      {!activeQuery && industryId && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  Software{softwareIds.length > 0 && ` (${softwareIds.length})`}
                </Button>
              }
            />
            <DropdownMenuContent align="start">
              {softwareOptions.data?.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s.id}
                  checked={softwareIds.some((r) => r.softwareId === s.id)}
                  onCheckedChange={(checked) => {
                    setPage(1);
                    setSoftwareIds((prev) =>
                      checked
                        ? [...prev, { softwareId: s.id, minProficiency: "INTERMEDIATE" }]
                        : prev.filter((r) => r.softwareId !== s.id),
                    );
                  }}
                >
                  {s.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  Skills{skillIds.length > 0 && ` (${skillIds.length})`}
                </Button>
              }
            />
            <DropdownMenuContent align="start">
              {skillOptions.data?.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s.id}
                  checked={skillIds.includes(s.id)}
                  onCheckedChange={(checked) => {
                    setPage(1);
                    setSkillIds((prev) => (checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)));
                  }}
                >
                  {s.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Input
            className="w-28"
            type="number"
            min={0}
            placeholder="Rate min"
            value={rateMin}
            onChange={(e) => {
              setPage(1);
              setRateMin(e.target.value);
            }}
          />
          <Input
            className="w-28"
            type="number"
            min={0}
            placeholder="Rate max"
            value={rateMax}
            onChange={(e) => {
              setPage(1);
              setRateMax(e.target.value);
            }}
          />
          <Input
            className="w-40"
            type="number"
            min={0}
            placeholder="Min hrs/wk"
            value={minWeeklyAvailability}
            onChange={(e) => {
              setPage(1);
              setMinWeeklyAvailability(e.target.value);
            }}
          />

          <Select
            items={[
              { value: "name", label: "Sort: Name" },
              { value: "rate", label: "Sort: Rate" },
            ]}
            value={sortBy}
            onValueChange={(v) => {
              setPage(1);
              setSortBy((v as "name" | "rate") ?? "name");
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort: Name</SelectItem>
              <SelectItem value="rate">Sort: Rate</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPage(1);
              setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            }}
          >
            {sortDir === "asc" ? <ArrowUpAZ className="size-3.5" /> : <ArrowDownAZ className="size-3.5" />}
          </Button>
        </div>
      )}

      {activeQuery && semanticResults.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {activeQuery && semanticResults.isError && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm text-muted-foreground">Couldn&apos;t run semantic search.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => semanticResults.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {activeQuery && semanticResults.data?.mode === "preview" && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Lock className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Subscribe to use semantic search</p>
        </div>
      )}

      {activeQuery && semanticResults.data?.mode === "full" && semanticResults.data.results.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Search className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">No matches for that description</p>
        </div>
      )}

      {activeQuery && semanticResults.data?.mode === "full" && semanticResults.data.results.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {semanticResults.data.results.length} candidates ranked by semantic match
            {!jobPostId && " — select a job post above to blend with match score and add to a board"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {semanticResults.data.results.map((c) => (
              <SemanticCandidateCard key={c.id} candidate={c} jobPostId={jobPostId} />
            ))}
          </div>
        </div>
      )}

      {!activeQuery && !industryId && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Search className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Pick a job post to search scored candidates</p>
          <p className="mt-1 text-sm text-muted-foreground">Or select an industry above to browse without scoring.</p>
        </div>
      )}

      {!activeQuery && results.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {!activeQuery && results.isError && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load search results.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => results.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!activeQuery && results.data?.mode === "full" && results.data.total === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Search className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">No candidates match</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different industry or job post.</p>
        </div>
      )}

      {!activeQuery && results.data?.mode === "preview" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {results.data.count} candidate{results.data.count === 1 ? "" : "s"} match — subscribe to see full
            profiles.
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

      {!activeQuery && results.data?.mode === "full" && results.data.total > 0 && (
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

      {!activeQuery && results.data && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="size-3.5" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page * PAGE_SIZE >= (results.data.mode === "full" ? results.data.total : results.data.count)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      )}

      <Dialog open={saveSearchOpen} onOpenChange={setSaveSearchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this search</DialogTitle>
            <DialogDescription>Give this search a name so you can recall it later.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="e.g. Senior QuickBooks VAs"
            value={saveSearchName}
            onChange={(e) => setSaveSearchName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveSearchOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!saveSearchName.trim() || saveSearch.isPending}
              onClick={() => {
                saveSearch.mutate({
                  name: saveSearchName.trim(),
                  filters: {
                    industryId,
                    jobPostId: jobPostId || undefined,
                    softwareIds: softwareIds.length ? softwareIds : undefined,
                    skillIds: skillIds.length ? skillIds : undefined,
                    rateMin: rateMin ? Number(rateMin) : undefined,
                    rateMax: rateMax ? Number(rateMax) : undefined,
                    minWeeklyAvailability: minWeeklyAvailability ? Number(minWeeklyAvailability) : undefined,
                  },
                });
                setSaveSearchName("");
                setSaveSearchOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
