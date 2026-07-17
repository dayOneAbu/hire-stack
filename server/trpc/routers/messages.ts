import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";

async function assertCanAccessApplication(
  prisma: typeof import("@/lib/prisma").prisma,
  userId: string,
  applicationId: string,
) {
  const application = await prisma.jobApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: { jobPost: true, candidate: true },
  });

  const staff = await prisma.employerStaff.findUnique({ where: { userId } });
  if (staff && staff.workspaceId === application.jobPost.workspaceId) {
    return application;
  }
  if (application.candidate.userId === userId) {
    return application;
  }
  throw new TRPCError({ code: "FORBIDDEN" });
}

export const messagesRouter = router({
  send: protectedProcedure
    .input(z.object({ applicationId: z.string().uuid(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertCanAccessApplication(ctx.prisma, ctx.session.user.id, input.applicationId);
      return ctx.prisma.message.create({
        data: {
          applicationId: input.applicationId,
          senderId: ctx.session.user.id,
          content: input.content,
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCanAccessApplication(ctx.prisma, ctx.session.user.id, input.applicationId);
      return ctx.prisma.message.findMany({
        where: { applicationId: input.applicationId },
        orderBy: { createdAt: "asc" },
      });
    }),

  markRead: protectedProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanAccessApplication(ctx.prisma, ctx.session.user.id, input.applicationId);
      await ctx.prisma.message.updateMany({
        where: { applicationId: input.applicationId, senderId: { not: ctx.session.user.id }, readAt: null },
        data: { readAt: new Date() },
      });
    }),
});
