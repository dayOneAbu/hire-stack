// ponytail: one-off backfill for candidates whose account.updated webhook never arrived
// (e.g. local dev without `stripe listen` running). Run: npx tsx scripts/resync-payouts.ts
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

async function main() {
  const candidates = await prisma.candidate.findMany({
    where: { stripeConnectAccountId: { not: null }, payoutsEnabled: false },
    select: { id: true, stripeConnectAccountId: true },
  });

  for (const c of candidates) {
    const account = await stripe.accounts.retrieve(c.stripeConnectAccountId!);
    if (account.payouts_enabled) {
      await prisma.candidate.update({
        where: { id: c.id },
        data: { payoutsEnabled: true },
      });
      console.log(`updated ${c.id}`);
    }
  }
}

main().then(() => process.exit(0));
