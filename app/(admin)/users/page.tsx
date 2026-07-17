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

export default function UsersPage() {
  const [query, setQuery] = useState("");
  const utils = trpc.useUtils();
  const results = trpc.admin.users.search.useQuery({ query }, { enabled: query.length > 0 });
  const suspend = trpc.admin.users.suspend.useMutation({
    onSuccess: () => {
      toast.success("User suspended");
      utils.admin.users.search.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const reinstate = trpc.admin.users.reinstate.useMutation({
    onSuccess: () => {
      toast.success("User reinstated");
      utils.admin.users.search.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only lookup by name or email. No bulk actions.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-9"
        />
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

        {results.data?.map((u) => (
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
                  onClick={() => {
                    if (window.confirm(`Suspend ${u.name ?? u.email}? They will be unable to sign in.`)) {
                      suspend.mutate({ userId: u.id });
                    }
                  }}
                >
                  Suspend
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
        {query.length > 0 && results.data?.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <UserX className="size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No users found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different name or email.</p>
          </div>
        )}
      </div>
    </div>
  );
}
