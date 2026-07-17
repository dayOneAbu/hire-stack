import { z } from "zod";
import { router, adminProcedure } from "@/server/trpc/trpc";
import { recomputeIsSearchable } from "@/server/services/publishGate";
import { refreshAnomalyEmbedding } from "@/server/services/embeddings";

export const reviewQueueRouter = router({
  list: adminProcedure.query(({ ctx }) =>
    ctx.prisma.employmentAnomaly.findMany({
      where: { status: "FLAGGED_FOR_ADMIN_REVIEW" },
      include: { employmentPeriod: { include: { candidate: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ),

  resolve: adminProcedure
    .input(
      z.object({
        anomalyId: z.string().uuid(),
        status: z.enum(["OVERRIDDEN_BY_ADMIN", "IGNORED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const anomaly = await ctx.prisma.employmentAnomaly.update({
        where: { id: input.anomalyId },
        data: { status: input.status, resolvedAt: new Date() },
        include: { employmentPeriod: true },
      });
      await refreshAnomalyEmbedding(anomaly.id);
      const isSearchable = await recomputeIsSearchable(anomaly.employmentPeriod.candidateId);
      return { anomaly, isSearchable };
    }),
});
