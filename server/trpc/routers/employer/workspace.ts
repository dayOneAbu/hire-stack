import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, employerProcedure, employerOwnerProcedure } from "@/server/trpc/trpc";

async function getWorkspaceId(prisma: typeof import("@/lib/prisma").prisma, userId: string) {
  const staff = await prisma.employerStaff.findUniqueOrThrow({ where: { userId } });
  return staff.workspaceId;
}

export const workspaceRouter = router({
  get: employerProcedure.query(async ({ ctx }) => {
    const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
    return ctx.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  }),

  rename: employerOwnerProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      return ctx.prisma.workspace.update({ where: { id: workspaceId }, data: { name: input.name } });
    }),

  listStaff: employerOwnerProcedure.query(async ({ ctx }) => {
    const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
    return ctx.prisma.employerStaff.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
  }),

  approveStaff: employerOwnerProcedure
    .input(z.object({ employerStaffId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const staff = await ctx.prisma.employerStaff.findUniqueOrThrow({ where: { id: input.employerStaffId } });
      if (staff.workspaceId !== workspaceId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.prisma.employerStaff.update({ where: { id: input.employerStaffId }, data: { approved: true } });
    }),

  removeStaff: employerOwnerProcedure
    .input(z.object({ employerStaffId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const staff = await ctx.prisma.employerStaff.findUniqueOrThrow({ where: { id: input.employerStaffId } });
      if (staff.workspaceId !== workspaceId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (staff.userId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Owners cannot remove themselves" });
      }
      await ctx.prisma.employerStaff.delete({ where: { id: input.employerStaffId } });
      return { deleted: true as const };
    }),
});
