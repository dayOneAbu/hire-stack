import { z } from "zod";
import { router, adminProcedure } from "@/server/trpc/trpc";

const PAGE_SIZE = 50;

export const auditTrailRouter = router({
  list: adminProcedure
    .input(
      z.object({
        action: z
          .enum([
            "USER_LOGIN",
            "USER_SUSPENDED",
            "USER_REINSTATED",
            "PROFILE_PUBLISHED",
            "RESUME_PARSED",
            "STRIPE_WEBHOOK_RECEIVED",
            "JOB_SLOT_EXCEEDED",
            "CANDIDATE_STAGE_TRANSITION",
            "TAXONOMY_MERGED",
          ])
          .optional(),
        page: z.number().int().positive().default(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = input.action ? { action: input.action } : {};
      const [total, entries] = await Promise.all([
        ctx.prisma.auditTrail.count({ where }),
        ctx.prisma.auditTrail.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          include: { user: { select: { name: true, email: true } } },
        }),
      ]);
      return { total, entries };
    }),
});
