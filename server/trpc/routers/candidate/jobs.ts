import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, candidateProcedure } from "@/server/trpc/trpc";
import { computeMatchScore } from "@/server/services/matchScore";
import { canWithdraw } from "@/server/services/applicationWithdraw";

async function getCandidateId(prisma: typeof import("@/lib/prisma").prisma, userId: string) {
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId } });
  return candidate.id;
}

export const jobsRouter = router({
  matched: candidateProcedure.query(async ({ ctx }) => {
    const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
    const jobPosts = await ctx.prisma.jobPost.findMany({ where: { status: "ACTIVE" } });
    const scored = await Promise.all(
      jobPosts.map(async (jobPost) => ({
        jobPost,
        overallScore: (await computeMatchScore(candidateId, jobPost.id)).overallMatchScore,
      })),
    );
    return scored.sort((a, b) => b.overallScore - a.overallScore);
  }),

  applyToJob: candidateProcedure
    .input(z.object({ jobPostId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
      const existing = await ctx.prisma.jobApplication.findUnique({
        where: { jobPostId_candidateId: { jobPostId: input.jobPostId, candidateId } },
      });
      if (existing) return existing;
      return ctx.prisma.jobApplication.create({
        data: { jobPostId: input.jobPostId, candidateId, source: "CANDIDATE_APPLIED", currentStage: "INBOX" },
      });
    }),

  myApplications: candidateProcedure.query(async ({ ctx }) => {
    const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
    return ctx.prisma.jobApplication.findMany({
      where: { candidateId },
      include: { jobPost: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  save: candidateProcedure
    .input(z.object({ jobPostId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
      return ctx.prisma.savedJob.upsert({
        where: { candidateId_jobPostId: { candidateId, jobPostId: input.jobPostId } },
        create: { candidateId, jobPostId: input.jobPostId },
        update: {},
      });
    }),

  unsave: candidateProcedure
    .input(z.object({ jobPostId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
      await ctx.prisma.savedJob.delete({
        where: { candidateId_jobPostId: { candidateId, jobPostId: input.jobPostId } },
      });
      return { deleted: true as const };
    }),

  withdraw: candidateProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
      const application = await ctx.prisma.jobApplication.findUniqueOrThrow({
        where: { id: input.applicationId },
      });
      if (application.candidateId !== candidateId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (!canWithdraw(application)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "The employer has already engaged with this application — contact them directly to withdraw.",
        });
      }
      await ctx.prisma.jobApplication.delete({ where: { id: input.applicationId } });
      return { deleted: true as const };
    }),

  savedList: candidateProcedure.query(async ({ ctx }) => {
    const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
    const saved = await ctx.prisma.savedJob.findMany({
      where: { candidateId },
      include: { jobPost: true },
      orderBy: { createdAt: "desc" },
    });
    return saved.map((s) => s.jobPost);
  }),
});
