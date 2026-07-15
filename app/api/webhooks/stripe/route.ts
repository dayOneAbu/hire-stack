import { stripe } from "@/lib/stripe";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// FRS §9: webhook drives subscriptionStatus/subscriptionTier for self-serve
// tiers. past_due blocks new activations but must not touch already-active
// jobs; only `canceled` pulls them from search.
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
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
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      // TODO: sync Workspace.subscriptionStatus/subscriptionTier
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
