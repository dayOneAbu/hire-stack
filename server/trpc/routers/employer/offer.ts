import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, employerProcedure } from "@/server/trpc/trpc";
import { getOfferUploadUrl, getOfferDownloadUrl } from "@/lib/storage";

async function getWorkspaceId(prisma: typeof import("@/lib/prisma").prisma, userId: string) {
  const staff = await prisma.employerStaff.findUniqueOrThrow({ where: { userId } });
  return staff.workspaceId;
}

async function assertApplicationInWorkspace(
  prisma: typeof import("@/lib/prisma").prisma,
  applicationId: string,
  workspaceId: string,
) {
  const application = await prisma.jobApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: { jobPost: true },
  });
  if (application.jobPost.workspaceId !== workspaceId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return application;
}

export const offerRouter = router({
  getUploadUrl: employerProcedure
    .input(z.object({ applicationId: z.string().uuid(), filename: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      await assertApplicationInWorkspace(ctx.prisma, input.applicationId, workspaceId);
      return getOfferUploadUrl(input.applicationId, input.filename);
    }),

  // Trigger is a UI affordance on HIRED, not a backend gate — Kanban stays fully
  // free-form (FRS §11/§19.1), so creation isn't coupled to currentStage here.
  create: employerProcedure
    .input(z.object({ applicationId: z.string().uuid(), documentUrl: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      await assertApplicationInWorkspace(ctx.prisma, input.applicationId, workspaceId);
      return ctx.prisma.offer.create({
        data: { applicationId: input.applicationId, documentUrl: input.documentUrl },
      });
    }),

  send: employerProcedure
    .input(z.object({ offerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const offer = await ctx.prisma.offer.findUniqueOrThrow({
        where: { id: input.offerId },
        include: { application: { include: { jobPost: true } } },
      });
      if (offer.application.jobPost.workspaceId !== workspaceId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.prisma.offer.update({
        where: { id: input.offerId },
        data: { status: "SENT", sentAt: new Date() },
      });
    }),

  byApplication: employerProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      await assertApplicationInWorkspace(ctx.prisma, input.applicationId, workspaceId);
      const offer = await ctx.prisma.offer.findUnique({ where: { applicationId: input.applicationId } });
      if (!offer) return null;
      return { ...offer, downloadUrl: await getOfferDownloadUrl(offer.documentUrl) };
    }),
});
