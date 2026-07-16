import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, employerProcedure } from "@/server/trpc/trpc";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const jobPostInput = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  industryId: z.string().uuid(),
  targetRateMin: z.number().positive().nullable().optional(),
  targetRateMax: z.number().positive().nullable().optional(),
  requiredHoursMin: z.number().int().positive().default(20),
  requiredSoftware: z
    .array(
      z.object({
        softwareId: z.string().uuid(),
        minProficiency: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]),
        isMandatory: z.boolean().default(true),
      }),
    )
    .default([]),
  requiredSkills: z
    .array(
      z.object({
        skillId: z.string().uuid(),
        minProficiency: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]),
      }),
    )
    .default([]),
});

async function getWorkspaceId(prisma: typeof import("@/lib/prisma").prisma, userId: string) {
  const staff = await prisma.employerStaff.findUniqueOrThrow({ where: { userId } });
  return staff.workspaceId;
}

export const jobPostRouter = router({
  create: employerProcedure.input(jobPostInput).mutation(async ({ ctx, input }) => {
    const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
    const { requiredSoftware, requiredSkills, ...data } = input;
    return ctx.prisma.jobPost.create({
      data: {
        ...data,
        workspaceId,
        requiredSoftware: { create: requiredSoftware },
        requiredSkills: { create: requiredSkills },
      },
      include: { requiredSoftware: true, requiredSkills: true },
    });
  }),

  update: employerProcedure
    .input(jobPostInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const { id, requiredSoftware, requiredSkills, ...data } = input;

      return ctx.prisma.$transaction(async (tx) => {
        if (requiredSoftware) {
          await tx.jobRequiredSoftware.deleteMany({ where: { jobPostId: id } });
        }
        if (requiredSkills) {
          await tx.jobRequiredSkill.deleteMany({ where: { jobPostId: id } });
        }
        return tx.jobPost.update({
          where: { id, workspaceId },
          data: {
            ...data,
            ...(requiredSoftware ? { requiredSoftware: { create: requiredSoftware } } : {}),
            ...(requiredSkills ? { requiredSkills: { create: requiredSkills } } : {}),
          },
          include: { requiredSoftware: true, requiredSkills: true },
        });
      });
    }),

  activate: employerProcedure
    .input(z.object({ jobPostId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const workspace = await ctx.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });

      // FRS/plan: job slot check ONLY fires here, live count query, never a stored counter.
      const activeCount = await ctx.prisma.jobPost.count({
        where: { workspaceId, status: "ACTIVE" },
      });
      if (activeCount >= workspace.jobSlotLimit) {
        await ctx.prisma.auditTrail.create({
          data: { userId: ctx.session.user.id, action: "JOB_SLOT_EXCEEDED", payload: { jobPostId: input.jobPostId } },
        });
        throw new TRPCError({ code: "FORBIDDEN", message: "Job slot limit reached" });
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + THIRTY_DAYS_MS);
      const jobPost = await ctx.prisma.jobPost.update({
        where: { id: input.jobPostId, workspaceId },
        data: { status: "ACTIVE", activatedAt: now, expiresAt },
      });
      return { status: jobPost.status, expiresAt: jobPost.expiresAt! };
    }),

  extend: employerProcedure
    .input(z.object({ jobPostId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const jobPost = await ctx.prisma.jobPost.findUniqueOrThrow({
        where: { id: input.jobPostId, workspaceId },
      });
      if (!jobPost.activatedAt || !jobPost.expiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Job post has never been activated" });
      }
      // one-time-only extension: original window is always activatedAt + 30d; if the current
      // expiry is already past that, it's already been extended once.
      const originalExpiry = new Date(jobPost.activatedAt.getTime() + THIRTY_DAYS_MS);
      if (jobPost.expiresAt.getTime() > originalExpiry.getTime()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Job post already extended" });
      }
      const newExpiresAt = new Date(jobPost.expiresAt.getTime() + THIRTY_DAYS_MS);
      const updated = await ctx.prisma.jobPost.update({
        where: { id: input.jobPostId },
        data: { expiresAt: newExpiresAt },
      });
      return { expiresAt: updated.expiresAt! };
    }),

  cloneFrom: employerProcedure
    .input(z.object({ sourceJobPostId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const source = await ctx.prisma.jobPost.findUniqueOrThrow({
        where: { id: input.sourceJobPostId, workspaceId },
        include: { requiredSoftware: true, requiredSkills: true },
      });
      return ctx.prisma.jobPost.create({
        data: {
          workspaceId,
          industryId: source.industryId,
          title: source.title,
          description: source.description,
          targetRateMin: source.targetRateMin,
          targetRateMax: source.targetRateMax,
          requiredHoursMin: source.requiredHoursMin,
          status: "DRAFT",
          requiredSoftware: {
            create: source.requiredSoftware.map((s) => ({
              softwareId: s.softwareId,
              minProficiency: s.minProficiency,
              isMandatory: s.isMandatory,
            })),
          },
          requiredSkills: {
            create: source.requiredSkills.map((s) => ({ skillId: s.skillId, minProficiency: s.minProficiency })),
          },
        },
        include: { requiredSoftware: true, requiredSkills: true },
      });
    }),

  // Soft-delete: job posts have application/note history worth preserving, so archiving
  // (not a hard delete) is the only removal path — matches the existing JobStatus.ARCHIVED value.
  archive: employerProcedure
    .input(z.object({ jobPostId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      return ctx.prisma.jobPost.update({
        where: { id: input.jobPostId, workspaceId },
        data: { status: "ARCHIVED" },
      });
    }),

  list: employerProcedure.query(async ({ ctx }) => {
    const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
    return ctx.prisma.jobPost.findMany({
      where: { workspaceId, status: { not: "ARCHIVED" } },
      include: { requiredSoftware: true, requiredSkills: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  byId: employerProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
    return ctx.prisma.jobPost.findUniqueOrThrow({
      where: { id: input.id, workspaceId },
      include: { requiredSoftware: true, requiredSkills: true },
    });
  }),
});
