import { z } from "zod";
import { router, adminProcedure } from "@/server/trpc/trpc";

const PAGE_SIZE = Number(process.env.NEXT_PUBLIC_PAGE_SIZE_USERS ?? 25);

export const usersRouter = router({
  search: adminProcedure
    .input(
      z.object({
        query: z.string().min(1),
        page: z.number().int().positive().default(1),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        OR: [
          { name: { contains: input.query, mode: "insensitive" as const } },
          { email: { contains: input.query, mode: "insensitive" as const } },
        ],
      };
      const [total, users] = await Promise.all([
        ctx.prisma.user.count({ where }),
        ctx.prisma.user.findMany({
          where,
          include: { candidateProfile: true, employerMember: { include: { workspace: true } } },
          orderBy: { createdAt: input.sortDir },
          skip: (input.page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
      ]);
      return { total, users };
    }),

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
