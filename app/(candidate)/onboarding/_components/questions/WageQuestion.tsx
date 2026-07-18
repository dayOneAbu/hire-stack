"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSafeErrorMessage } from "@/lib/utils";

const MAX_HOURLY_RATE = 500;

export function WageQuestion({
  periodId,
  anomalyId,
  onAnswered,
}: {
  periodId: string;
  anomalyId: string;
  onAnswered: (isSearchable: boolean) => void;
}) {
  const [rate, setRate] = useState("");
  const mutation = trpc.candidate.wizard.submitWage.useMutation({
    onSuccess: (res) => onAnswered(res.isSearchable),
    onError: (e) => toast.error(getSafeErrorMessage(e, "Couldn't save your answer. Try again.")),
  });
  const parsed = Number(rate);
  const valid = parsed > 0 && parsed <= MAX_HOURLY_RATE;

  return (
    <div className="space-y-3">
      <Label>Hourly rate (USD)</Label>
      <Input
        type="number"
        min="0"
        max={MAX_HOURLY_RATE}
        step="0.01"
        value={rate}
        onChange={(e) => setRate(e.target.value)}
      />
      {rate && !valid && (
        <p className="text-sm text-destructive">Enter a rate between $0 and ${MAX_HOURLY_RATE}.</p>
      )}
      <Button
        disabled={!valid}
        loading={mutation.isPending}
        loadingText="Saving…"
        onClick={() => mutation.mutate({ periodId, anomalyId, hourlyRate: parsed })}
      >
        Continue
      </Button>
    </div>
  );
}
