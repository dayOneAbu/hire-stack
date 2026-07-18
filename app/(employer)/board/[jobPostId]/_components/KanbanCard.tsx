"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn, getSafeErrorMessage } from "@/lib/utils";
import { FileSignature, MessageSquarePlus, MessagesSquare, MoreVertical, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type BoardApplication = {
  id: string;
  currentStage: string;
  overallMatchScore: number | null;
  candidate: { id: string; firstName: string; lastName: string };
  notes: { id: string; content: string; authorId: string }[];
};

function scoreTone(score: number | null) {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 80) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
  if (score >= 50) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
  return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400";
}

export function KanbanCard({
  app,
  onOpenNotes,
  onOpenMessages,
  onOpenOffer,
  onOpenAsk,
}: {
  app: BoardApplication;
  onOpenNotes: (applicationId: string) => void;
  onOpenMessages?: (applicationId: string) => void;
  onOpenOffer?: (applicationId: string) => void;
  onOpenAsk?: (applicationId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: app.id,
  });
  const utils = trpc.useUtils();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const removeCandidate = trpc.employer.board.removeCandidate.useMutation({
    onSuccess: () => {
      utils.employer.board.list.invalidate();
      setConfirmRemove(false);
    },
    onError: (e) => toast.error(getSafeErrorMessage(e)),
  });

  const initials = `${app.candidate.firstName[0] ?? ""}${app.candidate.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        "group cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow active:cursor-grabbing",
        isDragging ? "opacity-50 shadow-md ring-2 ring-primary" : "hover:shadow-md",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {app.candidate.firstName} {app.candidate.lastName}
          </p>
          <span
            className={cn(
              "mt-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium",
              scoreTone(app.overallMatchScore),
            )}
          >
            {app.overallMatchScore ?? "—"}% match
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
            className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          >
            <MoreVertical className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmRemove(true)}
            >
              Remove from board
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove from board?"
        description={`Remove ${app.candidate.firstName} ${app.candidate.lastName} from this board? This can't be undone.`}
        confirmLabel="Remove"
        pending={removeCandidate.isPending}
        onConfirm={() => removeCandidate.mutate({ applicationId: app.id })}
      />

      <div className="mt-3 flex items-center gap-1">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenNotes(app.id);
          }}
          className="flex flex-1 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MessageSquarePlus className="size-3.5" />
          {app.notes.length > 0 ? `${app.notes.length} note${app.notes.length === 1 ? "" : "s"}` : "Add note"}
        </button>
        {onOpenAsk && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onOpenAsk(app.id);
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Sparkles className="size-3.5" />
            Ask AI
          </button>
        )}
        {onOpenMessages && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onOpenMessages(app.id);
            }}
            className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <MessagesSquare className="size-3.5" />
            Message
          </button>
        )}
      </div>
      {app.currentStage === "HIRED" && onOpenOffer && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenOffer(app.id);
          }}
          className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary/10 px-1.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <FileSignature className="size-3.5" />
          Offer
        </button>
      )}
    </div>
  );
}
