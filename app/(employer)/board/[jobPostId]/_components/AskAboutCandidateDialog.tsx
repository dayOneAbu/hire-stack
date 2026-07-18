"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import type { BoardApplication } from "./KanbanCard";
import { getSafeErrorMessage } from "@/lib/utils";

export function AskAboutCandidateDialog({
  app,
  onClose,
}: {
  app: BoardApplication | null;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<Array<{ question: string; answer: string; chunks: { source: string; content: string }[] }>>([]);

  const ask = trpc.employer.search.askAboutCandidate.useMutation({
    onSuccess: (result, variables) => {
      setThread((t) => [...t, { question: variables.question, answer: result.answer, chunks: result.chunks }]);
      setQuestion("");
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });

  return (
    <Dialog
      open={app !== null}
      onOpenChange={(open) => {
        if (!open) {
          setThread([]);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask about {app ? `${app.candidate.firstName} ${app.candidate.lastName}` : ""}</DialogTitle>
          <DialogDescription>Answers are grounded only in this candidate&apos;s verified profile.</DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-4 overflow-y-auto">
          {thread.length === 0 && !ask.isPending && (
            <p className="text-sm text-muted-foreground">
              Ask something like &quot;Do they have experience with CRM tools?&quot;
            </p>
          )}
          {thread.map((turn, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm font-medium text-foreground">{turn.question}</p>
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">{turn.answer}</p>
              {turn.chunks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {turn.chunks.map((c, ci) => (
                    <Badge key={ci} variant="secondary" title={c.content}>
                      {c.source}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
          {ask.isPending && <p className="text-sm text-muted-foreground">Thinking…</p>}
        </div>

        <div className="flex gap-2">
          <Textarea
            placeholder="Ask a question about this candidate…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            className="flex-1"
          />
          <Button
            disabled={!question.trim() || ask.isPending || !app}
            onClick={() => app && ask.mutate({ candidateId: app.candidate.id, question: question.trim() })}
          >
            Ask
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
