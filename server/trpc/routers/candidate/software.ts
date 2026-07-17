import { z } from "zod";
import { router, candidateProcedure } from "@/server/trpc/trpc";

const PROFICIENCY = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;

export const softwareRouter = router({
  list: candidateProcedure.query(async ({ ctx }) => {
    const candidate = await ctx.prisma.candidate.findUniqueOrThrow({
      where: { userId: ctx.session.user.id },
    });
    return ctx.prisma.candidateSoftware.findMany({
      where: { candidateId: candidate.id },
      include: { software: true },
    });
  }),

  // Independent of the wizard, always shown (FRS §5).
  confirm: candidateProcedure
    .input(
      z.object({
        softwareId: z.string().uuid(),
        used: z.boolean(),
        proficiency: z.enum(PROFICIENCY).default("INTERMEDIATE"),
        yearsOfUsage: z.number().min(0).default(1),
        isCurrentlyUsed: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const candidate = await ctx.prisma.candidate.findUniqueOrThrow({
        where: { userId: ctx.session.user.id },
      });

      if (!input.used) {
        await ctx.prisma.candidateSoftware.deleteMany({
          where: { candidateId: candidate.id, softwareId: input.softwareId },
        });
        return;
      }

      await ctx.prisma.candidateSoftware.upsert({
        where: { candidateId_softwareId: { candidateId: candidate.id, softwareId: input.softwareId } },
        update: {
          proficiency: input.proficiency,
          yearsOfUsage: input.yearsOfUsage,
          isCurrentlyUsed: input.isCurrentlyUsed,
        },
        create: {
          candidateId: candidate.id,
          softwareId: input.softwareId,
          proficiency: input.proficiency,
          yearsOfUsage: input.yearsOfUsage,
          isCurrentlyUsed: input.isCurrentlyUsed,
        },
      });
    }),

  completeOnboarding: candidateProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.candidate.update({
      where: { userId: ctx.session.user.id },
      data: { onboardingCompletedAt: new Date() },
    });
  }),
});
