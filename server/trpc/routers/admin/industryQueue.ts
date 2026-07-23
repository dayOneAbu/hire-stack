import { z } from "zod";
import { router, adminProcedure } from "@/server/trpc/trpc";

export const industryQueueRouter = router({
  list: adminProcedure.query(({ ctx }) =>
    ctx.prisma.industry.findMany({
      where: { status: "SUGGESTED_BY_AI" },
      orderBy: { createdAt: "asc" },
    }),
  ),

  approve: adminProcedure
    .input(z.object({ industryId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [industry] = await ctx.prisma.$transaction([
        ctx.prisma.industry.update({
          where: { id: input.industryId },
          data: { status: "APPROVED_GLOBAL" },
        }),
        ctx.prisma.auditTrail.create({
          data: {
            action: "INDUSTRY_APPROVED",
            userId: ctx.session.user.id,
            payload: { industryId: input.industryId },
          },
        }),
      ]);
      return industry;
    }),

  merge: adminProcedure
    .input(z.object({ industryId: z.string().uuid(), intoId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [industry] = await ctx.prisma.$transaction([
        ctx.prisma.industry.update({
          where: { id: input.industryId },
          data: { status: "MERGED", mergedIntoId: input.intoId },
        }),
        ctx.prisma.auditTrail.create({
          data: {
            action: "TAXONOMY_MERGED",
            userId: ctx.session.user.id,
            payload: { industryId: input.industryId, intoId: input.intoId },
          },
        }),
      ]);
      return industry;
    }),
});
