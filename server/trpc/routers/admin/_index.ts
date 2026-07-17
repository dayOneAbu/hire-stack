import { router } from "@/server/trpc/trpc";
import { softwareQueueRouter } from "@/server/trpc/routers/admin/softwareQueue";
import { reviewQueueRouter } from "@/server/trpc/routers/admin/reviewQueue";
import { usersRouter } from "@/server/trpc/routers/admin/users";
import { auditTrailRouter } from "@/server/trpc/routers/admin/auditTrail";

export const adminRouter = router({
  softwareQueue: softwareQueueRouter,
  reviewQueue: reviewQueueRouter,
  users: usersRouter,
  auditTrail: auditTrailRouter,
});
