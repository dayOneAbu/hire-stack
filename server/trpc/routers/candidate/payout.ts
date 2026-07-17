import { router, candidateProcedure } from "@/server/trpc/trpc";
import { createConnectAccount, createAccountOnboardingLink } from "@/lib/stripe";

export const payoutRouter = router({
  connectOnboard: candidateProcedure.mutation(async ({ ctx }) => {
    const candidate = await ctx.prisma.candidate.findUniqueOrThrow({
      where: { userId: ctx.session.user.id },
    });

    let accountId = candidate.stripeConnectAccountId;
    if (!accountId) {
      accountId = await createConnectAccount(candidate.id);
      await ctx.prisma.candidate.update({
        where: { id: candidate.id },
        data: { stripeConnectAccountId: accountId },
      });
    }

    const url = await createAccountOnboardingLink(accountId);
    return { url };
  }),

  payoutStatus: candidateProcedure.query(async ({ ctx }) => {
    const candidate = await ctx.prisma.candidate.findUniqueOrThrow({
      where: { userId: ctx.session.user.id },
      select: { payoutsEnabled: true, stripeConnectAccountId: true },
    });
    return candidate;
  }),
});
