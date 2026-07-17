import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const ONE_TIME_PRICE = {
  consultation: { amount: 10000, name: "Consultation" },
  hireAssist: { amount: 250000, name: "Hire Assist" },
} as const;

export async function createSubscriptionCheckout(
  workspaceId: string,
  customerId: string,
  tier: "STARTER" | "TEAM",
) {
  const priceId =
    tier === "STARTER" ? process.env.STRIPE_PRICE_ID_STARTER : process.env.STRIPE_PRICE_ID_TEAM;
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/settings/billing?success=1`,
    cancel_url: `${APP_URL}/settings/billing`,
    metadata: { workspaceId },
  });
}

export async function createOneTimeCheckout(
  workspaceId: string,
  customerId: string,
  product: "consultation" | "hireAssist",
) {
  const { amount, name } = ONE_TIME_PRICE[product];
  return stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      { price_data: { currency: "usd", unit_amount: amount, product_data: { name } }, quantity: 1 },
    ],
    success_url: `${APP_URL}/settings/billing?success=1`,
    cancel_url: `${APP_URL}/settings/billing`,
    metadata: { workspaceId, product },
  });
}

export async function createPortalSession(customerId: string) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/settings/billing`,
  });
}

// Connect (Phase 9, FRS §21) — separate charges and transfers, not manual-capture holds
// (manual capture auto-cancels in 7-30 days, too short for a multi-week hiring engagement).
export async function createConnectAccount(candidateId: string) {
  const account = await stripe.accounts.create({
    type: "express",
    capabilities: { transfers: { requested: true } },
    metadata: { candidateId },
  });
  return account.id;
}

export async function createAccountOnboardingLink(accountId: string) {
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/payout-settings`,
    return_url: `${APP_URL}/payout-settings`,
    type: "account_onboarding",
  });
  return link.url;
}
