"use client";

import { trpc } from "@/lib/trpc/client";

const STAGE_LABELS: Record<string, string> = {
  INBOX: "Inbox",
  SCREENING: "Screening",
  TECHNICAL_ASSESSMENT: "Technical",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

export function FunnelChart({ jobPostId }: { jobPostId: string }) {
  const funnel = trpc.employer.board.funnel.useQuery({ jobPostId });
  if (!funnel.data) return null;

  const max = Math.max(1, ...funnel.data.map((s) => s.count));

  return (
    <div className="flex items-end gap-3 overflow-x-auto border-b border-border px-6 py-4">
      {funnel.data.map((s) => (
        <div key={s.stage} className="flex w-20 shrink-0 flex-col items-center gap-1">
          <div className="flex h-16 w-full items-end">
            <div
              className="w-full rounded-t bg-primary/70"
              style={{ height: `${(s.count / max) * 100}%` }}
              title={`${s.count} in ${STAGE_LABELS[s.stage]}`}
            />
          </div>
          <span className="text-xs font-medium text-foreground">{s.count}</span>
          <span className="text-center text-[10px] leading-tight text-muted-foreground">{STAGE_LABELS[s.stage]}</span>
          {s.avgDaysInStage != null && (
            <span className="text-[10px] text-muted-foreground">{s.avgDaysInStage.toFixed(1)}d avg</span>
          )}
        </div>
      ))}
    </div>
  );
}
