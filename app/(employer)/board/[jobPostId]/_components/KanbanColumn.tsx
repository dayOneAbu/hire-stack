"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { KanbanCard, type BoardApplication } from "./KanbanCard";

export function KanbanColumn({
  stage,
  label,
  applications,
  onOpenNotes,
  onOpenMessages,
  onOpenOffer,
}: {
  stage: string;
  label: string;
  applications: BoardApplication[];
  onOpenNotes: (applicationId: string) => void;
  onOpenMessages: (applicationId: string) => void;
  onOpenOffer: (applicationId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-72 shrink-0 flex-col rounded-xl bg-muted/50 transition-colors",
        isOver && "bg-accent/60 ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
          {applications.length}
        </span>
      </div>

      <SortableContext items={applications.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
          {applications.map((app) => (
            <KanbanCard
              key={app.id}
              app={app}
              onOpenNotes={onOpenNotes}
              onOpenMessages={onOpenMessages}
              onOpenOffer={onOpenOffer}
            />
          ))}
          {applications.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-6 text-xs text-muted-foreground">
              Drop candidates here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
