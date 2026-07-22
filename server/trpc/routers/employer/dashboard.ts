import { z } from "zod";
import { router, employerProcedure } from "@/server/trpc/trpc";

async function getWorkspaceId(prisma: typeof import("@/lib/prisma").prisma, userId: string) {
  const staff = await prisma.employerStaff.findUniqueOrThrow({ where: { userId } });
  return staff.workspaceId;
}

export const dashboardRouter = router({
  summary: employerProcedure
    .input(z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }).optional())
    .query(async ({ ctx, input }) => {
    const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
    const dateRange = input?.from || input?.to ? { gte: input?.from, lte: input?.to } : undefined;

    const [jobsByStatus, stageCounts, jobs, recentHistory] = await Promise.all([
      ctx.prisma.jobPost.groupBy({
        by: ["status"],
        where: { workspaceId },
        _count: { _all: true },
      }),
      ctx.prisma.jobApplication.groupBy({
        by: ["currentStage", "jobPostId"],
        where: { jobPost: { workspaceId } },
        _count: { _all: true },
      }),
      ctx.prisma.jobPost.findMany({
        where: { workspaceId },
        select: { id: true, title: true, status: true },
      }),
      ctx.prisma.applicationHistory.findMany({
        where: { application: { jobPost: { workspaceId } }, ...(dateRange ? { createdAt: dateRange } : {}) },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          toStage: true,
          createdAt: true,
          application: {
            select: {
              jobPostId: true,
              jobPost: { select: { title: true } },
              candidate: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);

    const jobTitleById = new Map(jobs.map((j) => [j.id, j.title]));

    // Aggregate per-stage totals across the workspace, but keep the per-job
    // breakdown too so each bar can deep-link to the job with the most of that stage.
    const stageTotals = new Map<string, { count: number; byJob: { jobPostId: string; jobTitle: string; count: number }[] }>();
    for (const row of stageCounts) {
      const entry = stageTotals.get(row.currentStage) ?? { count: 0, byJob: [] };
      entry.count += row._count._all;
      entry.byJob.push({
        jobPostId: row.jobPostId,
        jobTitle: jobTitleById.get(row.jobPostId) ?? "Untitled",
        count: row._count._all,
      });
      stageTotals.set(row.currentStage, entry);
    }
    const stages = [...stageTotals.entries()].map(([stage, { count, byJob }]) => ({
      stage,
      count,
      // Job with the most applications in this stage — where the "view" click lands.
      topJobPostId: byJob.sort((a, b) => b.count - a.count)[0]?.jobPostId ?? null,
    }));

    const activeJobs = jobsByStatus.find((s) => s.status === "ACTIVE")?._count._all ?? 0;
    const totalCandidates = stageCounts.reduce((sum, r) => sum + r._count._all, 0);
    const interviewing = stageTotals.get("INTERVIEW")?.count ?? 0;
    const offersOut = stageTotals.get("OFFER")?.count ?? 0;

    return {
      stats: { activeJobs, totalCandidates, interviewing, offersOut },
      jobsByStatus: jobsByStatus.map((s) => ({ status: s.status, count: s._count._all })),
      stages,
      recentActivity: recentHistory.map((h) => ({
        id: h.id,
        toStage: h.toStage,
        createdAt: h.createdAt,
        jobPostId: h.application.jobPostId,
        jobTitle: h.application.jobPost.title,
        candidateName: `${h.application.candidate.firstName} ${h.application.candidate.lastName}`,
      })),
      activePipelineJobs: jobs.filter((j) => j.status === "ACTIVE" || j.status === "PAUSED"),
    };
  }),
});
