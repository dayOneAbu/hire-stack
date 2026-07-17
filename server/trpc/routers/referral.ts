import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";

export const referralRouter = router({
  create: protectedProcedure
    .input(z.object({ refereeEmail: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.referral.create({
        data: { referrerId: ctx.session.user.id, refereeEmail: input.refereeEmail },
      });
    }),

  myReferrals: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.referral.findMany({
      where: { referrerId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Called once, right after signup, with the referrer's user id from a ?ref= link.
  // PENDING -> SIGNED_UP only; CONVERTED is driven by publishGate/billing webhook (7.3).
  claim: protectedProcedure
    .input(z.object({ referrerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const referral = await ctx.prisma.referral.findFirst({
        where: { referrerId: input.referrerId, refereeEmail: ctx.session.user.email, status: "PENDING" },
      });
      if (!referral) return null;
      return ctx.prisma.referral.update({ where: { id: referral.id }, data: { status: "SIGNED_UP" } });
    }),
});
