import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, candidateProcedure } from "@/server/trpc/trpc";
import { getOfferDownloadUrl } from "@/lib/storage";

async function getOfferForCandidate(
  prisma: typeof import("@/lib/prisma").prisma,
  userId: string,
  offerId: string,
) {
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId } });
  const offer = await prisma.offer.findUniqueOrThrow({
    where: { id: offerId },
    include: { application: true },
  });
  if (offer.application.candidateId !== candidate.id) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return offer;
}

export const offerRouter = router({
  byApplication: candidateProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const candidate = await ctx.prisma.candidate.findUniqueOrThrow({
        where: { userId: ctx.session.user.id },
      });
      const application = await ctx.prisma.jobApplication.findUniqueOrThrow({
        where: { id: input.applicationId },
      });
      if (application.candidateId !== candidate.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const offer = await ctx.prisma.offer.findUnique({ where: { applicationId: input.applicationId } });
      if (!offer) return null;
      return { ...offer, downloadUrl: await getOfferDownloadUrl(offer.documentUrl) };
    }),

  // Lightweight e-signature (FRS §19.1): typed legal name + timestamp + request IP,
  // not a vendor e-sign integration. Signing never locks the Kanban stage.
  sign: candidateProcedure
    .input(z.object({ offerId: z.string().uuid(), signerName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const offer = await getOfferForCandidate(ctx.prisma, ctx.session.user.id, input.offerId);
      if (offer.status !== "SENT") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This offer is not awaiting a signature." });
      }
      return ctx.prisma.offer.update({
        where: { id: input.offerId },
        data: {
          status: "SIGNED",
          signedAt: new Date(),
          signerName: input.signerName,
          signerIp: ctx.ipAddress,
        },
      });
    }),

  decline: candidateProcedure
    .input(z.object({ offerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const offer = await getOfferForCandidate(ctx.prisma, ctx.session.user.id, input.offerId);
      if (offer.status !== "SENT") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This offer is not awaiting a response." });
      }
      return ctx.prisma.offer.update({ where: { id: input.offerId }, data: { status: "DECLINED" } });
    }),
});
