import { on } from "node:events";
import { z } from "zod";
import { TRPCError, tracked } from "@trpc/server";
import { router, protectedProcedure, employerProcedure } from "@/server/trpc/trpc";
import { messageEvents, emitMessage, emitRead, emitTyping, type MessageEvent } from "@/server/services/messageEvents";

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
  const isStaff = staff && staff.workspaceId === application.jobPost.workspaceId;
  const isCandidate = application.candidate.userId === userId;
  if (!isStaff && !isCandidate) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  // Messaging only opens once the employer has moved the candidate past the initial
  // application stage — an untouched INBOX application has nothing to discuss yet.
  if (application.currentStage === "INBOX") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Messaging opens once the employer moves this application forward." });
  }

  return application;
}

export const messagesRouter = router({
  // Cross-job inbox for the employer's own workspace — one row per application
  // that has messages allowed (i.e. past INBOX), newest activity first.
  listThreads: employerProcedure.query(async ({ ctx }) => {
    const staff = await ctx.prisma.employerStaff.findUniqueOrThrow({
      where: { userId: ctx.session.user.id },
    });

    const applications = await ctx.prisma.jobApplication.findMany({
      where: {
        jobPost: { workspaceId: staff.workspaceId },
        currentStage: { not: "INBOX" },
      },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true } },
        jobPost: { select: { id: true, title: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: {
          select: { messages: { where: { senderId: { not: ctx.session.user.id }, readAt: null } } },
        },
      },
    });

    return applications
      .filter((a) => a.messages.length > 0)
      .map((a) => ({
        applicationId: a.id,
        jobPost: a.jobPost,
        candidate: a.candidate,
        lastMessage: a.messages[0],
        unreadCount: a._count.messages,
      }))
      .sort((a, b) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime());
  }),

  send: protectedProcedure
    .input(z.object({ applicationId: z.string().uuid(), content: z.string().trim().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertCanAccessApplication(ctx.prisma, ctx.session.user.id, input.applicationId);
      const message = await ctx.prisma.message.create({
        data: {
          applicationId: input.applicationId,
          senderId: ctx.session.user.id,
          content: input.content,
        },
      });
      emitMessage(message);
      return message;
    }),

  onMessage: protectedProcedure
    .input(z.object({ applicationId: z.string().uuid(), lastEventId: z.string().nullish() }))
    .subscription(async function* ({ ctx, input, signal }) {
      await assertCanAccessApplication(ctx.prisma, ctx.session.user.id, input.applicationId);

      if (input.lastEventId) {
        const lastMessage = await ctx.prisma.message.findUnique({ where: { id: input.lastEventId } });
        if (lastMessage) {
          const missed = await ctx.prisma.message.findMany({
            where: { applicationId: input.applicationId, createdAt: { gt: lastMessage.createdAt } },
            orderBy: { createdAt: "asc" },
          });
          for (const message of missed) {
            yield tracked(message.id, { type: "message", message } satisfies MessageEvent);
          }
        }
      }

      for await (const [event] of on(messageEvents, input.applicationId, { signal })) {
        const typed = event as MessageEvent;
        // Only real messages need a durable tracked id for reconnect replay above;
        // ephemeral read/typing pings are fine to miss on reconnect.
        if (typed.type === "message") {
          yield tracked(typed.message.id, typed);
        } else {
          yield typed;
        }
      }
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
      const { count } = await ctx.prisma.message.updateMany({
        where: { applicationId: input.applicationId, senderId: { not: ctx.session.user.id }, readAt: null },
        data: { readAt: new Date() },
      });
      if (count > 0) {
        emitRead(input.applicationId, ctx.session.user.id);
      }
    }),

  // Ephemeral typing signal — not persisted, best-effort, fine to drop under load.
  typing: protectedProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanAccessApplication(ctx.prisma, ctx.session.user.id, input.applicationId);
      emitTyping(input.applicationId, ctx.session.user.id);
    }),
});
