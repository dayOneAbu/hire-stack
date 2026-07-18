"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function WorkspaceSettingsPage() {
  const { data: session } = authClient.useSession();
  const isOwner = session?.user && (session.user as { role?: string }).role === "EMPLOYER_OWNER";
  const utils = trpc.useUtils();
  const [removeTarget, setRemoveTarget] = useState<{ id: string; label: string } | null>(null);

  const workspace = trpc.employer.workspace.get.useQuery();
  const staff = trpc.employer.workspace.listStaff.useQuery(undefined, { enabled: isOwner });

  const [name, setName] = useState("");
  useEffect(() => {
    if (workspace.data) setName(workspace.data.name);
  }, [workspace.data]);

  const rename = trpc.employer.workspace.rename.useMutation({
    onSuccess: () => {
      toast.success("Workspace renamed");
      utils.employer.workspace.get.invalidate();
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const approveStaff = trpc.employer.workspace.approveStaff.useMutation({
    onSuccess: () => utils.employer.workspace.listStaff.invalidate(),
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });
  const removeStaff = trpc.employer.workspace.removeStaff.useMutation({
    onSuccess: () => {
      utils.employer.workspace.listStaff.invalidate();
      setRemoveTarget(null);
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your team and workspace name.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspace name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Label htmlFor="workspaceName">Name</Label>
          <Input
            id="workspaceName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isOwner}
          />
        </CardContent>
        {isOwner && (
          <CardFooter>
            <Button disabled={!name || rename.isPending} onClick={() => rename.mutate({ name })}>
              {rename.isPending ? "Saving..." : "Save"}
            </Button>
          </CardFooter>
        )}
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>Approve or remove staff members.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {staff.data?.length ? (
              staff.data.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{s.user.name ?? s.user.email}</p>
                    <p className="text-xs text-muted-foreground">{s.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.approved ? "secondary" : "outline"}>
                      {s.approved ? "approved" : "pending"}
                    </Badge>
                    {!s.approved && (
                      <Button
                        size="sm"
                        disabled={approveStaff.isPending}
                        onClick={() => approveStaff.mutate({ employerStaffId: s.id })}
                      >
                        Approve
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={removeStaff.isPending || s.userId === session?.user.id}
                      onClick={() => setRemoveTarget({ id: s.id, label: s.user.name ?? s.user.email })}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No staff members yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove from workspace?"
        description={`${removeTarget?.label ?? "This person"} will lose access to this workspace.`}
        confirmLabel="Remove"
        pending={removeStaff.isPending}
        onConfirm={() => removeTarget && removeStaff.mutate({ employerStaffId: removeTarget.id })}
      />
    </div>
  );
}
