import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, candidateProcedure } from "@/server/trpc/trpc";
import { recomputeIsSearchable } from "@/server/services/publishGate";
import { runAnomalyRules } from "@/server/services/anomalyRules";

const EMPLOYMENT_TYPE_MAP = {
  ONE_EMPLOYER: "EMPLOYEE",
  AGENCY_MULTIPLE_CLIENTS: "VA_AGENCY",
  FREELANCE: "FREELANCE",
} as const;

async function getCandidateId(prisma: typeof import("@/lib/prisma").prisma, userId: string) {
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId } });
  return candidate.id;
}

async function getAnomalyOrThrow(
  prisma: typeof import("@/lib/prisma").prisma,
  anomalyId: string,
  candidateId: string,
) {
  const anomaly = await prisma.employmentAnomaly.findFirstOrThrow({
    where: { id: anomalyId, employmentPeriod: { candidateId } },
    include: { employmentPeriod: true },
  });
  return anomaly;
}

export const wizardRouter = router({
  getNextStep: candidateProcedure.query(async ({ ctx }) => {
    const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);

    const period = await ctx.prisma.employmentPeriod.findFirst({
      where: {
        candidateId,
        anomaliesDetected: { some: { status: "PENDING_CANDIDATE" } },
      },
      orderBy: { startDate: "asc" },
      include: {
        anomaliesDetected: { where: { status: "PENDING_CANDIDATE" } },
      },
    });

    const [totalPending, totalFlagged] = await Promise.all([
      ctx.prisma.employmentAnomaly.count({
        where: { status: "PENDING_CANDIDATE", employmentPeriod: { candidateId } },
      }),
      ctx.prisma.employmentAnomaly.count({
        where: { status: "FLAGGED_FOR_ADMIN_REVIEW", employmentPeriod: { candidateId } },
      }),
    ]);

    if (!period) return { period: null, anomalies: [], totalPending, totalFlagged };
    return { period, anomalies: period.anomaliesDetected, totalPending, totalFlagged };
  }),

  answerGrouping: candidateProcedure
    .input(
      z.object({
        anomalyId: z.string().uuid(),
        answer: z.enum([
          "ONE_EMPLOYER",
          "AGENCY_MULTIPLE_CLIENTS",
          "MULTIPLE_SEPARATE_CLIENTS",
          "FREELANCE",
          "NOT_SURE",
        ]),
        splits: z
          .array(
            z.object({
              companyName: z.string().min(1),
              jobTitle: z.string().min(1),
              startDate: z.coerce.date(),
              endDate: z.coerce.date().nullable(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
      const anomaly = await getAnomalyOrThrow(ctx.prisma, input.anomalyId, candidateId);

      if (input.answer === "NOT_SURE") {
        await ctx.prisma.employmentAnomaly.update({
          where: { id: anomaly.id },
          data: { status: "FLAGGED_FOR_ADMIN_REVIEW" },
        });
      } else if (input.answer === "MULTIPLE_SEPARATE_CLIENTS") {
        if (!input.splits || input.splits.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "splits required for MULTIPLE_SEPARATE_CLIENTS" });
        }
        const newPeriods = await Promise.all(
          input.splits.map((s) =>
            ctx.prisma.employmentPeriod.create({
              data: { candidateId, ...s, employmentType: "MULTIPLE_CLIENTS" },
            }),
          ),
        );
        await ctx.prisma.employmentPeriod.delete({ where: { id: anomaly.employmentPeriodId } });

        const allPeriods = await ctx.prisma.employmentPeriod.findMany({ where: { candidateId } });
        const rerun = runAnomalyRules(allPeriods).filter((a) =>
          newPeriods.some((p) => p.id === a.employmentPeriodId),
        );
        if (rerun.length > 0) {
          await ctx.prisma.employmentAnomaly.createMany({ data: rerun });
        }
      } else {
        await ctx.prisma.employmentPeriod.update({
          where: { id: anomaly.employmentPeriodId },
          data: { employmentType: EMPLOYMENT_TYPE_MAP[input.answer] },
        });
        await ctx.prisma.employmentAnomaly.update({
          where: { id: anomaly.id },
          data: { status: "RESOLVED_BY_CANDIDATE" },
        });
      }

      const isSearchable = await recomputeIsSearchable(candidateId);
      return { isSearchable };
    }),

  answerGap: candidateProcedure
    .input(z.object({ anomalyId: z.string().uuid(), answer: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
      await getAnomalyOrThrow(ctx.prisma, input.anomalyId, candidateId);

      await ctx.prisma.employmentAnomaly.update({
        where: { id: input.anomalyId },
        data: { status: "RESOLVED_BY_CANDIDATE", candidateAnswer: input.answer, resolvedAt: new Date() },
      });

      const isSearchable = await recomputeIsSearchable(candidateId);
      return { isSearchable };
    }),

  submitWage: candidateProcedure
    .input(z.object({ periodId: z.string().uuid(), anomalyId: z.string().uuid(), hourlyRate: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
      await getAnomalyOrThrow(ctx.prisma, input.anomalyId, candidateId);

      await ctx.prisma.employmentPeriod.update({
        where: { id: input.periodId },
        data: { documentedHourlyRate: input.hourlyRate },
      });
      await ctx.prisma.employmentAnomaly.update({
        where: { id: input.anomalyId },
        data: { status: "RESOLVED_BY_CANDIDATE", resolvedAt: new Date() },
      });

      const isSearchable = await recomputeIsSearchable(candidateId);
      return { isSearchable };
    }),

  undoAnswer: candidateProcedure
    .input(z.object({ anomalyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
      const anomaly = await getAnomalyOrThrow(ctx.prisma, input.anomalyId, candidateId);

      if (anomaly.status !== "RESOLVED_BY_CANDIDATE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only your own resolved answers can be undone.",
        });
      }

      await ctx.prisma.employmentAnomaly.update({
        where: { id: anomaly.id },
        data: { status: "PENDING_CANDIDATE", candidateAnswer: null, resolvedAt: null },
      });

      const isSearchable = await recomputeIsSearchable(candidateId);
      return { isSearchable };
    }),

  answerConfirmDeny: candidateProcedure
    .input(
      z.object({
        anomalyId: z.string().uuid(),
        confirmed: z.boolean(),
        correction: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
      const anomaly = await getAnomalyOrThrow(ctx.prisma, input.anomalyId, candidateId);

      if (input.correction) {
        if (anomaly.ruleType === "INCOMPLETE_ENTRY") {
          await ctx.prisma.employmentPeriod.update({
            where: { id: anomaly.employmentPeriodId },
            data: { jobTitle: input.correction },
          });
        } else {
          await ctx.prisma.employmentPeriod.update({
            where: { id: anomaly.employmentPeriodId },
            data: { description: input.correction },
          });
        }
      }

      await ctx.prisma.employmentAnomaly.update({
        where: { id: input.anomalyId },
        data: {
          status: "RESOLVED_BY_CANDIDATE",
          candidateAnswer: input.confirmed ? "confirmed" : "denied",
          resolvedAt: new Date(),
        },
      });

      const isSearchable = await recomputeIsSearchable(candidateId);
      return { isSearchable };
    }),
});
