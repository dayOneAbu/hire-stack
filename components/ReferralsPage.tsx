"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ListToolbar, ListPagination } from "@/components/ui/list-controls";
import { useListControls } from "@/lib/useListControls";
import { toast } from "sonner";

const STATUS_TONE: Record<string, string> = {
  PENDING: "",
  SIGNED_UP: "bg-blue-100 text-blue-800",
  CONVERTED: "bg-green-100 text-green-800",
};

export function ReferralsPage() {
  const session = authClient.useSession();
  const [email, setEmail] = useState("");
  const utils = trpc.useUtils();
  const referrals = trpc.referral.myReferrals.useQuery();
  const create = trpc.referral.create.useMutation({
    onSuccess: () => {
      toast.success("Referral saved");
      setEmail("");
      utils.referral.myReferrals.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const list = useListControls(referrals.data ?? [], (a, b, dir) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return dir === "desc" ? -diff : diff;
  });

  const referralLink =
    typeof window !== "undefined" && session.data?.user
      ? `${window.location.origin}/sign-up?ref=${session.data.user.id}`
      : "";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Referrals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite people to HireStack. Reward payout is handled manually once a referral converts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your referral link</CardTitle>
          <CardDescription>Share this so new sign-ups are credited to you.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input readOnly value={referralLink} />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(referralLink);
                toast.success("Copied");
              }}
            >
              Copy
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite by email</CardTitle>
          <CardDescription>Track a specific invite (optional — the link above works on its own).</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({ refereeEmail: email });
            }}
          >
            <div className="flex-1 space-y-1">
              <Label className="sr-only">Referee email</Label>
              <Input
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={create.isPending}>
              Add
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          {!!referrals.data?.length && (
            <ListToolbar sortDir={list.sortDir} onSortDirChange={list.setSortDir} sortLabel="Added" />
          )}
          {list.pageItems.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{r.refereeEmail}</span>
              <Badge variant="outline" className={STATUS_TONE[r.status]}>
                {r.status}
              </Badge>
            </div>
          ))}
          {referrals.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No referrals yet.</p>
          )}
          <ListPagination page={list.page} totalPages={list.totalPages} total={list.total} onPageChange={list.setPage} />
        </CardFooter>
      </Card>
    </div>
  );
}
