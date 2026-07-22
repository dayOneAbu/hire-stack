import { router } from "@/server/trpc/trpc";
import { searchRouter } from "@/server/trpc/routers/employer/search";
import { jobPostRouter } from "@/server/trpc/routers/employer/jobPost";
import { boardRouter } from "@/server/trpc/routers/employer/board";
import { industryRouter } from "@/server/trpc/routers/employer/industry";
import { savedSearchRouter } from "@/server/trpc/routers/employer/savedSearch";
import { workspaceRouter } from "@/server/trpc/routers/employer/workspace";
import { offerRouter } from "@/server/trpc/routers/employer/offer";
import { paymentRouter } from "@/server/trpc/routers/employer/payment";
import { dashboardRouter } from "@/server/trpc/routers/employer/dashboard";

export const employerRouter = router({
  search: searchRouter,
  jobPost: jobPostRouter,
  board: boardRouter,
  dashboard: dashboardRouter,
  industry: industryRouter,
  savedSearch: savedSearchRouter,
  workspace: workspaceRouter,
  offer: offerRouter,
  payment: paymentRouter,
});
