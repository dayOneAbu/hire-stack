import { z } from "zod";
import { router, adminProcedure } from "@/server/trpc/trpc";

export const usersRouter = router({
  search: adminProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(({ ctx, input }) =>
      ctx.prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: input.query, mode: "insensitive" } },
            { email: { contains: input.query, mode: "insensitive" } },
          ],
        },
        include: { candidateProfile: true, employerMember: { include: { workspace: true } } },
        take: 25,
      }),
    ),
});
