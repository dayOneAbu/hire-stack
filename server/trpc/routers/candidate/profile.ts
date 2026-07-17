import { z } from "zod";
import { router, candidateProcedure } from "@/server/trpc/trpc";
import { refreshCandidateChunks } from "@/server/services/embeddings";

export const profileRouter = router({
  get: candidateProcedure.query(async ({ ctx }) => {
    return ctx.prisma.candidate.findUniqueOrThrow({
      where: { userId: ctx.session.user.id },
    });
  }),

  update: candidateProcedure
    .input(
      z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        avatarUrl: z.string().url().nullable().optional(),
        bio: z.string().max(5000).nullable().optional(),
        targetHourlyRateMin: z.number().positive().nullable().optional(),
        targetHourlyRateMax: z.number().positive().nullable().optional(),
        weeklyAvailability: z.number().int().min(1).max(168).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const candidate = await ctx.prisma.candidate.update({
        where: { userId: ctx.session.user.id },
        data: input,
      });
      if (
        input.bio !== undefined ||
        input.targetHourlyRateMin !== undefined ||
        input.targetHourlyRateMax !== undefined ||
        input.weeklyAvailability !== undefined
      ) {
        await refreshCandidateChunks(candidate.id);
      }
      return candidate;
    }),
});
