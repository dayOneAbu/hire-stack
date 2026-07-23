import { z } from "zod";
import { router, employerProcedure } from "@/server/trpc/trpc";
import { stripe, createSubscriptionCheckout, createOneTimeCheckout, createPortalSession } from "@/lib/stripe";

async function getWorkspaceId(prisma: typeof import("@/lib/prisma").prisma, userId: string) {
  const staff = await prisma.employerStaff.findUniqueOrThrow({ where: { userId } });
  return staff.workspaceId;
}

async function getOrCreateCustomerId(prisma: typeof import("@/lib/prisma").prisma, workspaceId: string) {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  if (workspace.stripeCustomerId) return workspace.stripeCustomerId;
  const customer = await stripe.customers.create({ metadata: { workspaceId } });
  await prisma.workspace.update({ where: { id: workspaceId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export const billingRouter = router({
  status: employerProcedure.query(async ({ ctx }) => {
    const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
    const [workspace, activeJobCount] = await Promise.all([
      ctx.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
      ctx.prisma.jobPost.count({ where: { workspaceId, status: "ACTIVE" } }),
    ]);
    return {
      subscriptionTier: workspace.subscriptionTier,
      subscriptionStatus: workspace.subscriptionStatus,
      jobSlotLimit: workspace.jobSlotLimit,
      activeJobCount,
      hasConsultation: workspace.hasConsultation,
      hasHireAssist: workspace.hasHireAssist,
      hasCustomer: !!workspace.stripeCustomerId,
    };
  }),

  createCheckoutSession: employerProcedure
    .input(
      z.union([
        z.object({ tier: z.enum(["STARTER", "TEAM"]) }),
        z.object({ product: z.enum(["consultation", "hireAssist"]) }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const customerId = await getOrCreateCustomerId(ctx.prisma, workspaceId);
      const session =
        "tier" in input
          ? await createSubscriptionCheckout(workspaceId, customerId, input.tier)
          : await createOneTimeCheckout(workspaceId, customerId, input.product);
      return { url: session.url };
    }),

  createPortalSession: employerProcedure.mutation(async ({ ctx }) => {
    const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
    const customerId = await getOrCreateCustomerId(ctx.prisma, workspaceId);
    const session = await createPortalSession(customerId);
    return { url: session.url };
  }),
});
