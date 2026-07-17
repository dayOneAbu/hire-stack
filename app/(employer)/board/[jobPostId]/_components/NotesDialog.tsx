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
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Pencil, Trash2, X, Check } from "lucide-react";
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
  const { data: session } = authClient.useSession();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const invalidate = () => utils.employer.board.list.invalidate({ jobPostId });

  const addNote = trpc.employer.board.addNote.useMutation({
    onSuccess: () => {
      invalidate();
      setDraft("");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateNote = trpc.employer.board.updateNote.useMutation({
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteNote = trpc.employer.board.deleteNote.useMutation({
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e.message),
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
            app.notes.map((n) =>
              editingId === n.id ? (
                <div key={n.id} className="flex gap-2">
                  <Textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <div className="flex flex-col gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!editDraft || updateNote.isPending}
                      onClick={() => updateNote.mutate({ noteId: n.id, content: editDraft })}
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div key={n.id} className="group flex items-start gap-2 rounded-lg bg-muted px-3 py-2">
                  <p className="flex-1 text-sm text-foreground">{n.content}</p>
                  <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {n.authorId === session?.user.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        onClick={() => {
                          setEditingId(n.id);
                          setEditDraft(n.content);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      disabled={deleteNote.isPending}
                      onClick={() => deleteNote.mutate({ noteId: n.id })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ),
            )
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
