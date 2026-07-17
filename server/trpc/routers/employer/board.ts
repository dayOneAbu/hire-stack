import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, employerProcedure } from "@/server/trpc/trpc";
import { computeMatchScore } from "@/server/services/matchScore";

const kanbanStage = z.enum([
  "INBOX",
  "SCREENING",
  "TECHNICAL_ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
]);

async function getWorkspaceId(prisma: typeof import("@/lib/prisma").prisma, userId: string) {
  const staff = await prisma.employerStaff.findUniqueOrThrow({ where: { userId } });
  return staff.workspaceId;
}

async function assertJobPostInWorkspace(
  prisma: typeof import("@/lib/prisma").prisma,
  jobPostId: string,
  workspaceId: string,
) {
  await prisma.jobPost.findUniqueOrThrow({ where: { id: jobPostId, workspaceId } });
}

export const boardRouter = router({
  addCandidate: employerProcedure
    .input(z.object({ jobPostId: z.string().uuid(), candidateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      await assertJobPostInWorkspace(ctx.prisma, input.jobPostId, workspaceId);

      const existing = await ctx.prisma.jobApplication.findUnique({
        where: { jobPostId_candidateId: { jobPostId: input.jobPostId, candidateId: input.candidateId } },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Candidate already on this board" });
      }

      const score = await computeMatchScore(input.candidateId, input.jobPostId);
      return ctx.prisma.jobApplication.create({
        data: {
          jobPostId: input.jobPostId,
          candidateId: input.candidateId,
          currentStage: "INBOX",
          ...score,
        },
      });
    }),

  moveStage: employerProcedure
    .input(z.object({ applicationId: z.string().uuid(), toStage: kanbanStage, reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const application = await ctx.prisma.jobApplication.findUniqueOrThrow({
        where: { id: input.applicationId },
        include: { jobPost: true },
      });
      if (application.jobPost.workspaceId !== workspaceId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Fully free-form — any direction is valid, no workflow enforcement (FRS §11).
      const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.jobApplication.update({
          where: { id: input.applicationId },
          data: { currentStage: input.toStage },
        }),
        ctx.prisma.applicationHistory.create({
          data: {
            applicationId: input.applicationId,
            fromStage: application.currentStage,
            toStage: input.toStage,
            changedById: ctx.session.user.id,
            reason: input.reason,
          },
        }),
      ]);
      return updated;
    }),

  addNote: employerProcedure
    .input(z.object({ applicationId: z.string().uuid(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const application = await ctx.prisma.jobApplication.findUniqueOrThrow({
        where: { id: input.applicationId },
        include: { jobPost: true },
      });
      if (application.jobPost.workspaceId !== workspaceId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.prisma.note.create({
        data: { applicationId: input.applicationId, authorId: ctx.session.user.id, content: input.content },
      });
    }),

  updateNote: employerProcedure
    .input(z.object({ noteId: z.string().uuid(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const note = await ctx.prisma.note.findUniqueOrThrow({
        where: { id: input.noteId },
        include: { application: { include: { jobPost: true } } },
      });
      if (note.application.jobPost.workspaceId !== workspaceId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (note.authorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the author can edit this note" });
      }
      return ctx.prisma.note.update({ where: { id: input.noteId }, data: { content: input.content } });
    }),

  deleteNote: employerProcedure
    .input(z.object({ noteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const note = await ctx.prisma.note.findUniqueOrThrow({
        where: { id: input.noteId },
        include: { application: { include: { jobPost: true } } },
      });
      if (note.application.jobPost.workspaceId !== workspaceId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Any workspace staff may delete — notes are workspace-visible collaboration, not private (FRS §13).
      await ctx.prisma.note.delete({ where: { id: input.noteId } });
      return { deleted: true as const };
    }),

  removeCandidate: employerProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const application = await ctx.prisma.jobApplication.findUniqueOrThrow({
        where: { id: input.applicationId },
        include: { jobPost: true },
      });
      if (application.jobPost.workspaceId !== workspaceId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await ctx.prisma.jobApplication.delete({ where: { id: input.applicationId } });
      return { deleted: true as const };
    }),

  list: employerProcedure.input(z.object({ jobPostId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
    await assertJobPostInWorkspace(ctx.prisma, input.jobPostId, workspaceId);
    return ctx.prisma.jobApplication.findMany({
      where: { jobPostId: input.jobPostId },
      include: { notes: true, candidate: true },
    });
  }),
});
