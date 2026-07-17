import { router } from "@/server/trpc/trpc";
import { candidateRouter } from "@/server/trpc/routers/candidate/_index";
import { employerRouter } from "@/server/trpc/routers/employer/_index";
import { adminRouter } from "@/server/trpc/routers/admin/_index";
import { billingRouter } from "@/server/trpc/routers/billing";
import { messagesRouter } from "@/server/trpc/routers/messages";
import { referralRouter } from "@/server/trpc/routers/referral";

export const appRouter = router({
  candidate: candidateRouter,
  employer: employerRouter,
  admin: adminRouter,
  billing: billingRouter,
  messages: messagesRouter,
  referral: referralRouter,
});

export type AppRouter = typeof appRouter;
