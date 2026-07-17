import { router } from "@/server/trpc/trpc";
import { resumeRouter } from "@/server/trpc/routers/candidate/resume";
import { wizardRouter } from "@/server/trpc/routers/candidate/wizard";
import { softwareRouter } from "@/server/trpc/routers/candidate/software";
import { employmentPeriodRouter } from "@/server/trpc/routers/candidate/employmentPeriod";
import { jobsRouter } from "@/server/trpc/routers/candidate/jobs";
import { profileRouter } from "@/server/trpc/routers/candidate/profile";
import { offerRouter } from "@/server/trpc/routers/candidate/offer";

export const candidateRouter = router({
  resume: resumeRouter,
  wizard: wizardRouter,
  software: softwareRouter,
  employmentPeriod: employmentPeriodRouter,
  jobs: jobsRouter,
  profile: profileRouter,
  offer: offerRouter,
});
