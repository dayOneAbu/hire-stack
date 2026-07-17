import type { SubscriptionTier } from "@prisma/client";

// ponytail: ENTERPRISE isn't self-serve (FRS §8) — admin sets jobSlotLimit by hand, never via this map
export const TIER_SLOT_MAP: Record<Exclude<SubscriptionTier, "ENTERPRISE">, number> = {
  FREE: 0,
  STARTER: 1,
  TEAM: 3,
};

export const PRICE_ID_TIER_MAP: Record<string, "STARTER" | "TEAM"> = {
  [process.env.STRIPE_PRICE_ID_STARTER ?? ""]: "STARTER",
  [process.env.STRIPE_PRICE_ID_TEAM ?? ""]: "TEAM",
};
