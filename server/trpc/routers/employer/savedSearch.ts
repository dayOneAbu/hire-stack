import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, employerProcedure } from "@/server/trpc/trpc";

async function getWorkspaceId(prisma: typeof import("@/lib/prisma").prisma, userId: string) {
  const staff = await prisma.employerStaff.findUniqueOrThrow({ where: { userId } });
  return staff.workspaceId;
}

export const savedSearchRouter = router({
  save: employerProcedure
    .input(z.object({ name: z.string().min(1), filters: z.record(z.string(), z.any()) }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      return ctx.prisma.savedSearch.create({
        data: {
          workspaceId,
          createdById: ctx.session.user.id,
          filters: { name: input.name, ...input.filters },
        },
      });
    }),

  list: employerProcedure.query(async ({ ctx }) => {
    const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
    return ctx.prisma.savedSearch.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
  }),

  delete: employerProcedure
    .input(z.object({ savedSearchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await getWorkspaceId(ctx.prisma, ctx.session.user.id);
      const search = await ctx.prisma.savedSearch.findUniqueOrThrow({ where: { id: input.savedSearchId } });
      if (search.workspaceId !== workspaceId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await ctx.prisma.savedSearch.delete({ where: { id: input.savedSearchId } });
      return { deleted: true as const };
    }),
});
