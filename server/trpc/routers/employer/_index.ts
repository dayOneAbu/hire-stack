import { router } from "@/server/trpc/trpc";
import { searchRouter } from "@/server/trpc/routers/employer/search";
import { jobPostRouter } from "@/server/trpc/routers/employer/jobPost";
import { boardRouter } from "@/server/trpc/routers/employer/board";
import { industryRouter } from "@/server/trpc/routers/employer/industry";

export const employerRouter = router({
  search: searchRouter,
  jobPost: jobPostRouter,
  board: boardRouter,
  industry: industryRouter,
});
