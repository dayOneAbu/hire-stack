import { router } from "@/server/trpc/trpc";

export const appRouter = router({
  // candidate: candidateRouter,   // wizard, employment periods, software/skills confirmation
  // employer: employerRouter,     // search, job posts, Kanban board
  // admin: adminRouter,           // software queue, employment-review queue
  // billing: billingRouter,       // Stripe checkout, portal, webhooks
});

export type AppRouter = typeof appRouter;
