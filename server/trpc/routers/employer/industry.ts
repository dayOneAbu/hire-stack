import { router, employerProcedure } from "@/server/trpc/trpc";

export const industryRouter = router({
  list: employerProcedure.query(({ ctx }) => ctx.prisma.industry.findMany({ orderBy: { name: "asc" } })),
});
