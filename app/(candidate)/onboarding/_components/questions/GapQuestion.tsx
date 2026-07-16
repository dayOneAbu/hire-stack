"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function GapQuestion({
  anomalyId,
  onAnswered,
}: {
  anomalyId: string;
  onAnswered: (isSearchable: boolean) => void;
}) {
  const [answer, setAnswer] = useState("");
  const mutation = trpc.candidate.wizard.answerGap.useMutation({
    onSuccess: (res) => onAnswered(res.isSearchable),
  });

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="What were you doing during this gap?"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <Button
        disabled={!answer.trim() || mutation.isPending}
        onClick={() => mutation.mutate({ anomalyId, answer })}
      >
        Continue
      </Button>
    </div>
  );
}
