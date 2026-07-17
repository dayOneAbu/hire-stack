export type HistoryRow = { applicationId: string; toStage: string; createdAt: Date };
export type StageCount = { currentStage: string; _count: { _all: number } };

export type FunnelStage = { stage: string; count: number; avgDaysInStage: number | null };

// Days spent in a stage = time between entering it (a row's toStage + createdAt) and the
// next recorded transition for that application, computed from consecutive history rows per
// applicationId. History rows must be sorted ascending by createdAt. Note: an application's
// initial INBOX dwell time is never captured, since applications are created directly in
// INBOX with no history row for that entry — only stages reached via a later moveStage
// transition get a measured duration.
export function computeFunnel(stages: readonly string[], counts: StageCount[], history: HistoryRow[]): FunnelStage[] {
  const daysInStage = new Map<string, number[]>();
  const enteredStageAt = new Map<string, { stage: string; at: Date }>();
  for (const row of history) {
    const entered = enteredStageAt.get(row.applicationId);
    if (entered) {
      const days = (row.createdAt.getTime() - entered.at.getTime()) / (1000 * 60 * 60 * 24);
      daysInStage.set(entered.stage, [...(daysInStage.get(entered.stage) ?? []), days]);
    }
    enteredStageAt.set(row.applicationId, { stage: row.toStage, at: row.createdAt });
  }

  return stages.map((stage) => {
    const durations = daysInStage.get(stage) ?? [];
    return {
      stage,
      count: counts.find((c) => c.currentStage === stage)?._count._all ?? 0,
      avgDaysInStage: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    };
  });
}
