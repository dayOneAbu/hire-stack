"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CORRECTION_LABEL: Record<string, string> = {
  INCOMPLETE_ENTRY: "Correct job title",
  UNUSUAL_JOB_DURATION: "Add a note (optional)",
  CRITICAL_CERT_MISSING: "Add a note (optional)",
};

export function ConfirmDenyQuestion({
  anomalyId,
  ruleType,
  onAnswered,
}: {
  anomalyId: string;
  ruleType: string;
  onAnswered: (isSearchable: boolean) => void;
}) {
  const [correction, setCorrection] = useState("");
  const [pendingAction, setPendingAction] = useState<"confirm" | "deny" | null>(null);
  const mutation = trpc.candidate.wizard.answerConfirmDeny.useMutation({
    onSuccess: (res) => onAnswered(res.isSearchable),
    onError: (e) => {
      setPendingAction(null);
      toast.error(e.message || "Couldn't save your answer. Try again.");
    },
  });

  function submit(confirmed: boolean) {
    setPendingAction(confirmed ? "confirm" : "deny");
    mutation.mutate({ anomalyId, confirmed, correction: correction.trim() || undefined });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>{CORRECTION_LABEL[ruleType] ?? "Add a note (optional)"}</Label>
        <Input value={correction} onChange={(e) => setCorrection(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button
          disabled={mutation.isPending}
          loading={mutation.isPending && pendingAction === "confirm"}
          loadingText="Saving…"
          onClick={() => submit(true)}
        >
          Confirm
        </Button>
        <Button
          variant="outline"
          disabled={mutation.isPending}
          loading={mutation.isPending && pendingAction === "deny"}
          loadingText="Saving…"
          onClick={() => submit(false)}
        >
          Deny
        </Button>
      </div>
    </div>
  );
}
