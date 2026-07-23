"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, UserX } from "lucide-react";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListPagination } from "@/components/ui/list-controls";
import { ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = Number(process.env.NEXT_PUBLIC_PAGE_SIZE_USERS ?? 25);
const ALL = "all";

const ROLE_LABELS: Record<
  "SUPER_ADMIN" | "PLATFORM_OPERATOR" | "EMPLOYER_OWNER" | "EMPLOYER_RECRUITER" | "CANDIDATE",
  string
> = {
  SUPER_ADMIN: "Super admin",
  PLATFORM_OPERATOR: "Platform operator",
  EMPLOYER_OWNER: "Employer owner",
  EMPLOYER_RECRUITER: "Employer recruiter",
  CANDIDATE: "Candidate",
};

export default function UsersPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [role, setRole] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [candidateSearchable, setCandidateSearchable] = useState<string>(ALL);
  const [employerApproval, setEmployerApproval] = useState<string>(ALL);
  const [suspendTarget, setSuspendTarget] = useState<{ id: string; label: string } | null>(null);
  const utils = trpc.useUtils();
  const stats = trpc.admin.users.stats.useQuery();
  const results = trpc.admin.users.search.useQuery({
    query,
    page,
    sortDir,
    role: role === ALL ? undefined : (role as keyof typeof ROLE_LABELS),
    status: status === ALL ? undefined : (status as "active" | "suspended" | "unverified"),
    candidateSearchable: candidateSearchable === ALL ? undefined : (candidateSearchable as "yes" | "no"),
    employerApproval: employerApproval === ALL ? undefined : (employerApproval as "approved" | "pending"),
  });
  const suspend = trpc.admin.users.suspend.useMutation({
    onSuccess: () => {
      toast.success("User suspended");
      utils.admin.users.search.invalidate();
      utils.admin.users.stats.invalidate();
      setSuspendTarget(null);
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const reinstate = trpc.admin.users.reinstate.useMutation({
    onSuccess: () => {
      toast.success("User reinstated");
      utils.admin.users.search.invalidate();
      utils.admin.users.stats.invalidate();
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only lookup by name or email. No bulk actions.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.isLoading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-18.5 w-full" />)}
        {stats.data && (
          <>
            <StatCard label="Total users" value={stats.data.total} />
            <StatCard label="Candidates" value={stats.data.candidates} />
            <StatCard label="Employer staff" value={stats.data.employers} />
            <StatCard label="Active jobs" value={stats.data.activeJobs} />
            <StatCard label="Searchable candidates" value={stats.data.searchableCandidates} />
            <StatCard label="Pending employer approval" value={stats.data.pendingEmployers} />
            <StatCard label="Suspended" value={stats.data.suspended} />
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email..."
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSortDir((d) => (d === "desc" ? "asc" : "desc"));
            setPage(1);
          }}
        >
          {sortDir === "desc" ? <ArrowDownAZ className="size-3.5" /> : <ArrowUpAZ className="size-3.5" />}
          Joined: {sortDir === "desc" ? "Newest" : "Oldest"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          value={role}
          onValueChange={(v) => {
            setRole(v ?? ALL);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All roles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v ?? ALL);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="unverified">Unverified email</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={candidateSearchable}
          onValueChange={(v) => {
            setCandidateSearchable(v ?? ALL);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-52"><SelectValue placeholder="Candidate searchable" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any searchability</SelectItem>
            <SelectItem value="yes">Searchable</SelectItem>
            <SelectItem value="no">Not searchable</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={employerApproval}
          onValueChange={(v) => {
            setEmployerApproval(v ?? ALL);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48"><SelectValue placeholder="Employer approval" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any approval state</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="pending">Pending approval</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {results.isLoading && (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        )}

        {results.isError && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load search results.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => results.refetch()}>
              Retry
            </Button>
          </div>
        )}

        {results.data?.users.map((u) => (
          <Card key={u.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {u.name ?? u.email}
                <Badge variant="outline">{u.role}</Badge>
                {!u.emailVerified && <Badge variant="outline">unverified</Badge>}
                {u.deletedAt && <Badge variant="destructive">deleted</Badge>}
              </CardTitle>
              <CardDescription>{u.email}</CardDescription>
            </CardHeader>
            {(u.candidateProfile || u.employerMember) && (
              <CardContent className="text-sm text-muted-foreground">
                {u.candidateProfile && (
                  <p>Candidate · searchable: {u.candidateProfile.isSearchable ? "yes" : "no"}</p>
                )}
                {u.employerMember && (
                  <p>
                    Employer staff · {u.employerMember.workspace.name} ·{" "}
                    {u.employerMember.approved ? "approved" : "pending approval"}
                  </p>
                )}
              </CardContent>
            )}
            <CardFooter className="justify-end">
              {u.deletedAt ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={reinstate.isPending}
                  onClick={() => reinstate.mutate({ userId: u.id })}
                >
                  Reinstate
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={suspend.isPending}
                  onClick={() => setSuspendTarget({ id: u.id, label: u.name ?? u.email })}
                >
                  Suspend
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
        {query.length > 0 && results.data?.users.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <UserX className="size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No users found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different name or email.</p>
          </div>
        )}
      </div>

      {results.data && results.data.total > 0 && (
        <ListPagination
          page={page}
          totalPages={Math.max(1, Math.ceil(results.data.total / PAGE_SIZE))}
          total={results.data.total}
          onPageChange={setPage}
        />
      )}

      <ConfirmDialog
        open={suspendTarget !== null}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
        title="Suspend user?"
        description={`${suspendTarget?.label ?? "This user"} will be unable to sign in until reinstated.`}
        confirmLabel="Suspend"
        pending={suspend.isPending}
        onConfirm={() => suspendTarget && suspend.mutate({ userId: suspendTarget.id })}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
