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
import { trpc } from "@/lib/trpc/client";
import type { BoardApplication } from "./KanbanCard";

export function NotesDialog({
  app,
  jobPostId,
  onClose,
}: {
  app: BoardApplication | null;
  jobPostId: string;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState("");

  const addNote = trpc.employer.board.addNote.useMutation({
    onSuccess: () => {
      utils.employer.board.list.invalidate({ jobPostId });
      setDraft("");
    },
  });

  return (
    <Dialog
      open={app !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{app ? `${app.candidate.firstName} ${app.candidate.lastName}` : ""}</DialogTitle>
          <DialogDescription>Notes are visible to your whole workspace.</DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {app?.notes.length ? (
            app.notes.map((n) => (
              <p key={n.id} className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                {n.content}
              </p>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}
        </div>

        <div className="flex gap-2">
          <Textarea
            placeholder="Add a note…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="flex-1"
          />
          <Button
            disabled={!draft || addNote.isPending}
            onClick={() => app && addNote.mutate({ applicationId: app.id, content: draft })}
          >
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
