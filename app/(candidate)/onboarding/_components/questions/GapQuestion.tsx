"use client";

import { useState } from "react";
import { toast } from "sonner";
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
    onError: (e) => toast.error(e.message || "Couldn't save your answer. Try again."),
  });

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="What were you doing during this gap?"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <Button
        disabled={!answer.trim()}
        loading={mutation.isPending}
        loadingText="Saving…"
        onClick={() => mutation.mutate({ anomalyId, answer })}
      >
        Continue
      </Button>
    </div>
  );
}
