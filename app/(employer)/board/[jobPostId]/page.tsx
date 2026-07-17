"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { KanbanColumn } from "./_components/KanbanColumn";
import { KanbanCard, type BoardApplication } from "./_components/KanbanCard";
import { NotesDialog } from "./_components/NotesDialog";
import { MessagesDialog } from "./_components/MessagesDialog";
import { OfferDialog } from "./_components/OfferDialog";
import { AskAboutCandidateDialog } from "./_components/AskAboutCandidateDialog";

const STAGES = [
  { value: "INBOX", label: "Inbox" },
  { value: "SCREENING", label: "Screening" },
  { value: "TECHNICAL_ASSESSMENT", label: "Technical assessment" },
  { value: "INTERVIEW", label: "Interview" },
  { value: "OFFER", label: "Offer" },
  { value: "HIRED", label: "Hired" },
  { value: "REJECTED", label: "Rejected" },
] as const;

type Stage = (typeof STAGES)[number]["value"];

export default function BoardPage({ params }: { params: Promise<{ jobPostId: string }> }) {
  const { jobPostId } = use(params);
  const utils = trpc.useUtils();
  const jobPost = trpc.employer.jobPost.byId.useQuery({ id: jobPostId });
  const board = trpc.employer.board.list.useQuery({ jobPostId });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notesAppId, setNotesAppId] = useState<string | null>(null);
  const [messagesAppId, setMessagesAppId] = useState<string | null>(null);
  const [offerAppId, setOfferAppId] = useState<string | null>(null);
  const [askAppId, setAskAppId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const moveStage = trpc.employer.board.moveStage.useMutation({
    onMutate: async ({ applicationId, toStage }) => {
      await utils.employer.board.list.cancel({ jobPostId });
      const previous = utils.employer.board.list.getData({ jobPostId });
      utils.employer.board.list.setData({ jobPostId }, (old) =>
        old?.map((a) => (a.id === applicationId ? { ...a, currentStage: toStage } : a)),
      );
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) utils.employer.board.list.setData({ jobPostId }, ctx.previous);
      toast.error(e.message);
    },
    onSettled: () => utils.employer.board.list.invalidate({ jobPostId }),
  });

  const applications = useMemo(() => board.data ?? [], [board.data]);
  const byStage = useMemo(() => {
    const grouped = new Map<string, BoardApplication[]>();
    for (const stage of STAGES) grouped.set(stage.value, []);
    for (const app of applications) {
      grouped.get(app.currentStage)?.push(app);
    }
    return grouped;
  }, [applications]);

  const activeApp = applications.find((a) => a.id === activeId) ?? null;
  const notesApp = applications.find((a) => a.id === notesAppId) ?? null;
  const messagesApp = applications.find((a) => a.id === messagesAppId) ?? null;
  const offerApp = applications.find((a) => a.id === offerAppId) ?? null;
  const askApp = applications.find((a) => a.id === askAppId) ?? null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const app = applications.find((a) => a.id === active.id);
    if (!app) return;

    const overIsStage = STAGES.some((s) => s.value === over.id);
    const targetStage = overIsStage
      ? (over.id as Stage)
      : applications.find((a) => a.id === over.id)?.currentStage;

    if (!targetStage || targetStage === app.currentStage) return;
    moveStage.mutate({ applicationId: app.id, toStage: targetStage as Stage });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-5">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Job posts
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          {jobPost.data?.title ?? "Hiring board"}
        </h1>
        <p className="text-sm text-muted-foreground">Drag candidates across stages as they progress.</p>
      </div>

      {board.isLoading ? (
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {STAGES.map((s) => (
            <Skeleton key={s.value} className="h-full w-72 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 gap-4 overflow-x-auto p-6">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage.value}
                stage={stage.value}
                label={stage.label}
                applications={byStage.get(stage.value) ?? []}
                onOpenNotes={setNotesAppId}
                onOpenMessages={setMessagesAppId}
                onOpenOffer={setOfferAppId}
                onOpenAsk={setAskAppId}
              />
            ))}
          </div>

          <DragOverlay>
            {activeApp && <KanbanCard app={activeApp} onOpenNotes={() => {}} />}
          </DragOverlay>
        </DndContext>
      )}

      <NotesDialog app={notesApp} jobPostId={jobPostId} onClose={() => setNotesAppId(null)} />
      <MessagesDialog app={messagesApp} onClose={() => setMessagesAppId(null)} />
      <OfferDialog app={offerApp} onClose={() => setOfferAppId(null)} />
      <AskAboutCandidateDialog app={askApp} onClose={() => setAskAppId(null)} />
    </div>
  );
}
