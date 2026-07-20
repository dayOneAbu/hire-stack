import { z } from "zod";
import { router, employerProcedure } from "@/server/trpc/trpc";

export const industryRouter = router({
  list: employerProcedure.query(({ ctx }) => ctx.prisma.industry.findMany({ orderBy: { name: "asc" } })),

  // FRS §15: filter options are drawn from approved taxonomy only.
  software: employerProcedure
    .input(z.object({ industryId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.prisma.software.findMany({
        where: { industryId: input.industryId, status: "APPROVED_GLOBAL" },
        orderBy: { name: "asc" },
      }),
    ),

  skills: employerProcedure
    .input(z.object({ industryId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.prisma.skill.findMany({
        where: { industryId: input.industryId, status: "APPROVED_GLOBAL" },
        orderBy: { name: "asc" },
      }),
    ),
});
