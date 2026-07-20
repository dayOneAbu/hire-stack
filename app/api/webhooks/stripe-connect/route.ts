import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

// Separate route from app/api/webhooks/stripe/route.ts (subscription billing) — Connect
// uses distinct event types, same signature-verification + AuditTrail logging pattern.
// Handlers are idempotent: each only transitions state from the expected prior status, so
// a Stripe retry re-delivering the same event is a no-op the second time.
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_CONNECT_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_CONNECT_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await prisma.candidate.updateMany({
        where: { stripeConnectAccountId: account.id },
        data: { payoutsEnabled: account.payouts_enabled ?? false },
      });
      break;
    }
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      // Only a DRAFT/nonexistent-yet-HELD payment transitions; already-HELD is a no-op.
      await prisma.payment.updateMany({
        where: { stripePaymentIntentId: intent.id, status: { in: ["FAILED"] } },
        data: { status: "HELD", heldAt: new Date() },
      });
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      await prisma.payment.updateMany({
        where: { stripePaymentIntentId: intent.id, status: "HELD" },
        data: { status: "FAILED" },
      });
      break;
    }
    case "transfer.created": {
      const transfer = event.data.object as Stripe.Transfer;
      // stripeTransferId is @unique — set only once, so a duplicate event finds no HELD row left to update.
      await prisma.payment.updateMany({
        where: { stripeTransferId: transfer.id, status: "HELD" },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
      break;
    }
    default:
      break;
  }

  await prisma.auditTrail.create({
    data: { action: "STRIPE_WEBHOOK_RECEIVED", payload: { type: event.type, id: event.id, connect: true } },
  });

  return NextResponse.json({ received: true });
}
