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

  // Single-user only — FRS §14 deliberately excludes bulk ops, keep it that way.
  suspend: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.prisma.$transaction([
        ctx.prisma.user.update({ where: { id: input.userId }, data: { deletedAt: new Date() } }),
        ctx.prisma.auditTrail.create({
          data: { userId: ctx.session.user.id, action: "USER_SUSPENDED", payload: { targetUserId: input.userId } },
        }),
      ]);
      return user;
    }),

  reinstate: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.prisma.$transaction([
        ctx.prisma.user.update({ where: { id: input.userId }, data: { deletedAt: null } }),
        ctx.prisma.auditTrail.create({
          data: { userId: ctx.session.user.id, action: "USER_REINSTATED", payload: { targetUserId: input.userId } },
        }),
      ]);
      return user;
    }),
});
