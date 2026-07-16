import { router } from "@/server/trpc/trpc";
import { candidateRouter } from "@/server/trpc/routers/candidate/_index";
import { employerRouter } from "@/server/trpc/routers/employer/_index";

export const appRouter = router({
  candidate: candidateRouter,
  employer: employerRouter,
  // admin: adminRouter,           // software queue, employment-review queue
  // billing: billingRouter,       // Stripe checkout, portal, webhooks
});

export type AppRouter = typeof appRouter;
