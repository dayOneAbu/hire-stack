"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

type Draft = {
  companyName: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
};

const EMPTY: Draft = { companyName: "", jobTitle: "", startDate: "", endDate: "" };

export function ManualEntry({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const utils = trpc.useUtils();
  const create = trpc.candidate.employmentPeriod.create.useMutation({
    onSuccess: () => {
      void utils.candidate.wizard.getNextStep.invalidate();
      void utils.candidate.employmentPeriod.list.invalidate();
      setDraft(EMPTY);
      toast.success("Role added.");
    },
    onError: (e) => toast.error(e.message || "Couldn't add that role. Try again."),
  });
  const list = trpc.candidate.employmentPeriod.list.useQuery();

  const canSubmit = draft.companyName && draft.jobTitle && draft.startDate;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add employment manually</CardTitle>
        <CardDescription>Add one or more roles, then continue to review any flags.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.data && list.data.length > 0 && (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {list.data.map((p) => (
              <li key={p.id}>
                {p.companyName} — {p.jobTitle}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <Label>Company name</Label>
          <Input
            value={draft.companyName}
            onChange={(e) => setDraft((d) => ({ ...d, companyName: e.target.value }))}
          />
          <Label>Job title</Label>
          <Input value={draft.jobTitle} onChange={(e) => setDraft((d) => ({ ...d, jobTitle: e.target.value }))} />
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label>Start date</Label>
              <Input
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label>End date (blank if current)</Label>
              <Input
                type="date"
                value={draft.endDate}
                onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          disabled={!canSubmit}
          loading={create.isPending}
          loadingText="Adding…"
          onClick={() =>
            create.mutate({
              companyName: draft.companyName,
              jobTitle: draft.jobTitle,
              startDate: new Date(draft.startDate),
              endDate: draft.endDate ? new Date(draft.endDate) : null,
            })
          }
        >
          Add role
        </Button>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!list.data || list.data.length === 0}
          onClick={onSaved}
        >
          Done adding roles
        </Button>
      </CardFooter>
    </Card>
  );
}
