import { z } from "zod";
import { router, candidateProcedure } from "@/server/trpc/trpc";
import { runAnomalyRules } from "@/server/services/anomalyRules";
import { recomputeIsSearchable } from "@/server/services/publishGate";

const periodInput = z.object({
  companyName: z.string().min(1),
  jobTitle: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable(),
  description: z.string().nullable().optional(),
  documentedHourlyRate: z.number().positive().nullable().optional(),
});

// Same rule pass as AI extraction — manual entry isn't a separate code path (FRS §16).
async function rerunAnomaliesFor(
  prisma: typeof import("@/lib/prisma").prisma,
  candidateId: string,
  periodId: string,
) {
  await prisma.employmentAnomaly.deleteMany({
    where: { employmentPeriodId: periodId, status: "PENDING_CANDIDATE" },
  });
  const allPeriods = await prisma.employmentPeriod.findMany({ where: { candidateId } });
  const anomalies = runAnomalyRules(allPeriods).filter((a) => a.employmentPeriodId === periodId);
  if (anomalies.length > 0) {
    await prisma.employmentAnomaly.createMany({ data: anomalies });
  }
}

export const employmentPeriodRouter = router({
  create: candidateProcedure.input(periodInput).mutation(async ({ ctx, input }) => {
    const candidate = await ctx.prisma.candidate.findUniqueOrThrow({
      where: { userId: ctx.session.user.id },
    });
    const period = await ctx.prisma.employmentPeriod.create({
      data: { candidateId: candidate.id, ...input },
    });
    await rerunAnomaliesFor(ctx.prisma, candidate.id, period.id);
    await recomputeIsSearchable(candidate.id);
    return period;
  }),

  update: candidateProcedure
    .input(periodInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const candidate = await ctx.prisma.candidate.findUniqueOrThrow({
        where: { userId: ctx.session.user.id },
      });
      const { id, ...data } = input;
      const period = await ctx.prisma.employmentPeriod.update({
        where: { id, candidateId: candidate.id },
        data,
      });
      await rerunAnomaliesFor(ctx.prisma, candidate.id, period.id);
      await recomputeIsSearchable(candidate.id);
      return period;
    }),

  delete: candidateProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const candidate = await ctx.prisma.candidate.findUniqueOrThrow({
      where: { userId: ctx.session.user.id },
    });
    await ctx.prisma.employmentPeriod.delete({ where: { id: input.id, candidateId: candidate.id } });
    await recomputeIsSearchable(candidate.id);
  }),

  list: candidateProcedure.query(async ({ ctx }) => {
    const candidate = await ctx.prisma.candidate.findUniqueOrThrow({
      where: { userId: ctx.session.user.id },
    });
    return ctx.prisma.employmentPeriod.findMany({
      where: { candidateId: candidate.id },
      include: { anomaliesDetected: true },
      orderBy: { startDate: "asc" },
    });
  }),
});
