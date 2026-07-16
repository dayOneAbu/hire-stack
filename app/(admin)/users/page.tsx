"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

export default function UsersPage() {
  const [query, setQuery] = useState("");
  const results = trpc.admin.users.search.useQuery({ query }, { enabled: query.length > 0 });

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
          </Card>
        ))}
        {query.length > 0 && results.data?.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No users found.</p>
        )}
      </div>
    </div>
  );
}
