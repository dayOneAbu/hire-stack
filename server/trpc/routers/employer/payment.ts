import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, employerProcedure } from "@/server/trpc/trpc";
import { stripe } from "@/lib/stripe";

async function getWorkspaceId(prisma: typeof import("@/lib/prisma").prisma, userId: string) {
  const staff = await prisma.employerStaff.findUniqueOrThrow({ where: { userId } });
  return staff.workspaceId;
}

export const paymentRouter = router({
  // requires application.offer.status === "SIGNED" and candidate.payoutsEnabled === true,
  // else throws PRECONDITION_FAILED. Creates an unconfirmed PaymentIntent and returns its
  // client_secret for the employer to confirm client-side via Stripe Elements — the actual
  // Payment row (status=HELD) is created by the payment_intent.succeeded webhook, not here,
  // since confirmation (3DS, card errors) happens after this call returns.
  fund: employerProcedure
    .input(z.object({ applicationId: z.string().uuid(), amount: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const application = await ctx.prisma.jobApplication.findUniqueOrThrow({
        where: { id: input.applicationId },
        include: { jobPost: true, offer: true, candidate: true },
      });
      if (application.jobPost.workspaceId !== workspaceId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (application.offer?.status !== "SIGNED") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Offer must be signed before funding." });
      }
      if (!application.candidate.payoutsEnabled) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Candidate has not completed payout onboarding yet.",
        });
      }

      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: Math.round(input.amount * 100),
          currency: "usd",
          automatic_payment_methods: { enabled: true },
          metadata: { applicationId: input.applicationId, candidateId: application.candidateId, amount: String(input.amount) },
        },
        { idempotencyKey: `fund-${input.applicationId}` },
      );

      return { clientSecret: paymentIntent.client_secret };
    }),

  // creates a Transfer to candidate.stripeConnectAccountId for Payment.amount.
  // Payment.status -> RELEASED, stripeTransferId + releasedAt set. Explicit action only —
  // no automatic/timed release for MVP.
  release: employerProcedure
    .input(z.object({ paymentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const payment = await ctx.prisma.payment.findUniqueOrThrow({
        where: { id: input.paymentId },
        include: { application: { include: { jobPost: true } }, candidate: true },
      });
      if (payment.application.jobPost.workspaceId !== workspaceId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (payment.status !== "HELD") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only a HELD payment can be released." });
      }
      if (!payment.candidate.stripeConnectAccountId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Candidate has no connected payout account." });
      }

      const transfer = await stripe.transfers.create({
        amount: Math.round(Number(payment.amount) * 100),
        currency: payment.currency,
        destination: payment.candidate.stripeConnectAccountId,
        transfer_group: payment.applicationId,
      });

      return ctx.prisma.payment.update({
        where: { id: input.paymentId },
        data: { status: "RELEASED", stripeTransferId: transfer.id, releasedAt: new Date() },
      });
    }),

  // only valid while status === HELD; standard refund against the original PaymentIntent.
  // Payment.status -> REFUNDED
  refund: employerProcedure
    .input(z.object({ paymentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const payment = await ctx.prisma.payment.findUniqueOrThrow({
        where: { id: input.paymentId },
        include: { application: { include: { jobPost: true } } },
      });
      if (payment.application.jobPost.workspaceId !== workspaceId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (payment.status !== "HELD") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only a HELD payment can be refunded." });
      }

      await stripe.refunds.create({ payment_intent: payment.stripePaymentIntentId });

      return ctx.prisma.payment.update({
        where: { id: input.paymentId },
        data: { status: "REFUNDED" },
      });
    }),

  byApplication: employerProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const application = await ctx.prisma.jobApplication.findUniqueOrThrow({
        where: { id: input.applicationId },
        include: { jobPost: true },
      });
      if (application.jobPost.workspaceId !== workspaceId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.prisma.payment.findFirst({
        where: { applicationId: input.applicationId },
        orderBy: { createdAt: "desc" },
      });
    }),
});
