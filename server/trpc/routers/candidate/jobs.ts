import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, candidateProcedure } from "@/server/trpc/trpc";
import { computeMatchScore } from "@/server/services/matchScore";
import { canWithdraw } from "@/server/services/applicationWithdraw";
import { meanCandidateEmbedding, searchJobPosts } from "@/server/services/embeddings";
import { rankByRelevance } from "@/server/services/aiRanking";

async function getCandidateId(prisma: typeof import("@/lib/prisma").prisma, userId: string) {
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId } });
  return candidate.id;
}

// FRS §9: only `canceled` pulls active jobs from candidate-facing search/matching.
const notCanceledWorkspace = { workspace: { subscriptionStatus: { not: "CANCELED" as const } } };

export const jobsRouter = router({
  matched: candidateProcedure.query(async ({ ctx }) => {
    const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
    const jobPosts = await ctx.prisma.jobPost.findMany({
      where: { status: "ACTIVE", ...notCanceledWorkspace },
    });
    const scored = await Promise.all(
      jobPosts.map(async (jobPost) => ({
        jobPost,
        overallScore: await computeMatchScore(candidateId, jobPost.id),
      })),
    );
    return rankByRelevance(scored);
  }),

  // Semantic "recommended for you": mean of the candidate's own chunk embeddings vs
  // JobPostEmbedding, distinct from `matched`'s deterministic FRS §10 score.
  recommended: candidateProcedure.query(async ({ ctx }) => {
    const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
    const meanEmbedding = await meanCandidateEmbedding(candidateId);
    if (!meanEmbedding) return [];

    const matches = await searchJobPosts(meanEmbedding, 10);
    const jobPosts = await ctx.prisma.jobPost.findMany({
      where: { id: { in: matches.map((m) => m.jobPostId) }, status: "ACTIVE", ...notCanceledWorkspace },
    });
    const byId = new Map(jobPosts.map((j) => [j.id, j]));

    return matches
      .map((m) => {
        const jobPost = byId.get(m.jobPostId);
        return jobPost ? { jobPost, similarity: m.similarity } : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }),

  byId: candidateProcedure
    .input(z.object({ jobPostId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
      const jobPost = await ctx.prisma.jobPost.findUniqueOrThrow({
        where: { id: input.jobPostId },
        include: {
          workspace: true,
          industry: true,
          requiredSoftware: { include: { software: true } },
          requiredSkills: { include: { skill: true } },
        },
      });
      const [overallScore, saved, application] = await Promise.all([
        computeMatchScore(candidateId, jobPost.id),
        ctx.prisma.savedJob.findUnique({
          where: { candidateId_jobPostId: { candidateId, jobPostId: jobPost.id } },
        }),
        ctx.prisma.jobApplication.findUnique({
          where: { jobPostId_candidateId: { jobPostId: jobPost.id, candidateId } },
        }),
      ]);
      return { jobPost, overallScore, isSaved: !!saved, application };
    }),

  applyToJob: candidateProcedure
    .input(z.object({ jobPostId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const candidateId = await getCandidateId(ctx.prisma, ctx.session.user.id);
      const existing = await ctx.prisma.jobApplication.findUnique({
        where: { jobPostId_candidateId: { jobPostId: input.jobPostId, candidateId } },
      });
      if (existing) return existing;

      const jobPost = await ctx.prisma.jobPost.findUniqueOrThrow({ where: { id: input.jobPostId } });
      if (jobPost.status !== "ACTIVE") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This job is no longer accepting applications" });
      }

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
          message: "The employer has already engaged with this application — message them to withdraw.",
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
