import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { router, adminProcedure } from "@/server/trpc/trpc";

const PAGE_SIZE = Number(process.env.NEXT_PUBLIC_PAGE_SIZE_USERS ?? 25);

const ROLES = ["SUPER_ADMIN", "PLATFORM_OPERATOR", "EMPLOYER_OWNER", "EMPLOYER_RECRUITER", "CANDIDATE"] as const;

export const usersRouter = router({
  stats: adminProcedure.query(async ({ ctx }) => {
    const [total, candidates, employers, searchableCandidates, pendingEmployers, suspended, activeJobs] =
      await Promise.all([
        ctx.prisma.user.count({ where: { deletedAt: null } }),
        ctx.prisma.user.count({ where: { deletedAt: null, role: "CANDIDATE" } }),
        ctx.prisma.user.count({
          where: { deletedAt: null, role: { in: ["EMPLOYER_OWNER", "EMPLOYER_RECRUITER"] } },
        }),
        ctx.prisma.candidate.count({ where: { isSearchable: true } }),
        ctx.prisma.employerStaff.count({ where: { approved: false } }),
        ctx.prisma.user.count({ where: { deletedAt: { not: null } } }),
        ctx.prisma.jobPost.count({ where: { status: "ACTIVE" } }),
      ]);
    return { total, candidates, employers, searchableCandidates, pendingEmployers, suspended, activeJobs };
  }),

  search: adminProcedure
    .input(
      z.object({
        query: z.string().default(""),
        page: z.number().int().positive().default(1),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
        role: z.enum(ROLES).optional(),
        status: z.enum(["active", "suspended", "unverified"]).optional(),
        candidateSearchable: z.enum(["yes", "no"]).optional(),
        employerApproval: z.enum(["approved", "pending"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.UserWhereInput = {
        ...(input.query && {
          OR: [
            { name: { contains: input.query, mode: "insensitive" as const } },
            { email: { contains: input.query, mode: "insensitive" as const } },
          ],
        }),
        ...(input.role && { role: input.role }),
        ...(input.status === "suspended" && { deletedAt: { not: null } }),
        ...(input.status === "active" && { deletedAt: null }),
        ...(input.status === "unverified" && { emailVerified: false }),
        ...(input.candidateSearchable && {
          candidateProfile: { isSearchable: input.candidateSearchable === "yes" },
        }),
        ...(input.employerApproval && {
          employerMember: { approved: input.employerApproval === "approved" },
        }),
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
