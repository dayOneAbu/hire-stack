"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  });
  const parsed = Number(rate);

  return (
    <div className="space-y-3">
      <Label>Hourly rate (USD)</Label>
      <Input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
      <Button
        disabled={!(parsed > 0) || mutation.isPending}
        onClick={() => mutation.mutate({ periodId, anomalyId, hourlyRate: parsed })}
      >
        Continue
      </Button>
    </div>
  );
}
