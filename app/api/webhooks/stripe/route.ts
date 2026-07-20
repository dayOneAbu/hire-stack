import { stripe } from "@/lib/stripe";
import { TIER_SLOT_MAP, PRICE_ID_TIER_MAP } from "@/lib/billing-config";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

const STATUS_MAP: Record<Stripe.Subscription.Status, "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE"> = {
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  unpaid: "PAST_DUE",
  incomplete: "INCOMPLETE",
  incomplete_expired: "CANCELED",
  trialing: "ACTIVE",
  paused: "PAST_DUE",
};

async function syncSubscription(sub: Stripe.Subscription) {
  const workspace = await prisma.workspace.findUnique({ where: { stripeCustomerId: sub.customer as string } });
  if (!workspace) return;

  const priceId = sub.items.data[0]?.price.id;
  const tier = (priceId && PRICE_ID_TIER_MAP[priceId]) || workspace.subscriptionTier;
  const status = STATUS_MAP[sub.status] ?? "INCOMPLETE";
  const wasFirstPaidActivation = status === "ACTIVE" && workspace.subscriptionStatus !== "ACTIVE";

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      stripeSubscriptionId: sub.id,
      subscriptionStatus: status,
      subscriptionTier: tier,
      jobSlotLimit: tier === "ENTERPRISE" ? workspace.jobSlotLimit : TIER_SLOT_MAP[tier],
    },
  });

  // Referral conversion on first paid subscription (7.3) — reward payout stays manual/off-platform.
  if (wasFirstPaidActivation) {
    const owner = await prisma.employerStaff.findFirst({
      where: { workspaceId: workspace.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    if (owner) {
      await prisma.referral.updateMany({
        where: { refereeEmail: owner.user.email, status: "SIGNED_UP" },
        data: { status: "CONVERTED" },
      });
    }
  }
}

// FRS §9: webhook drives subscriptionStatus/subscriptionTier for self-serve
// tiers. past_due blocks new activations but must not touch already-active
// jobs; only `canceled` pulls them from search.
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const product = session.metadata?.product;
      const workspaceId = session.metadata?.workspaceId;
      if (session.mode === "payment" && workspaceId && (product === "consultation" || product === "hireAssist")) {
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: product === "consultation" ? { hasConsultation: true } : { hasHireAssist: true },
        });
      }
      break;
    }
    default:
      break;
  }

  await prisma.auditTrail.create({
    data: { action: "STRIPE_WEBHOOK_RECEIVED", payload: { type: event.type, id: event.id } },
  });

  return NextResponse.json({ received: true });
}
