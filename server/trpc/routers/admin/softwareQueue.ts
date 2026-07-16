import { z } from "zod";
import { router, adminProcedure } from "@/server/trpc/trpc";

export const softwareQueueRouter = router({
  list: adminProcedure.query(({ ctx }) =>
    ctx.prisma.software.findMany({
      where: { status: "SUGGESTED_BY_AI" },
      include: { industry: true },
      orderBy: { createdAt: "asc" },
    }),
  ),

  approve: adminProcedure
    .input(z.object({ softwareId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.software.update({
        where: { id: input.softwareId },
        data: { status: "APPROVED_GLOBAL" },
      }),
    ),

  merge: adminProcedure
    .input(z.object({ softwareId: z.string().uuid(), intoId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [software] = await ctx.prisma.$transaction([
        ctx.prisma.software.update({
          where: { id: input.softwareId },
          data: { status: "MERGED", mergedIntoId: input.intoId },
        }),
        ctx.prisma.auditTrail.create({
          data: {
            action: "TAXONOMY_MERGED",
            userId: ctx.session.user.id,
            payload: { softwareId: input.softwareId, intoId: input.intoId },
          },
        }),
      ]);
      return software;
    }),
});
