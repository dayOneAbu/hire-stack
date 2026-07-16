import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { router, employerProcedure } from "@/server/trpc/trpc";
import { canViewFullProfile } from "@/server/services/employerAccess";
import { computeMatchScore } from "@/server/services/matchScore";

const PAGE_SIZE = 20;

const searchInput = z.object({
  industryId: z.string().uuid(),
  softwareIds: z
    .array(z.object({ softwareId: z.string().uuid(), minProficiency: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]) }))
    .optional(),
  skillIds: z.array(z.string().uuid()).optional(),
  rateMin: z.number().optional(),
  rateMax: z.number().optional(),
  minWeeklyAvailability: z.number().optional(),
  jobPostId: z.string().uuid().optional(),
  page: z.number().int().positive().default(1),
});

function rateRangeBucket(min: number | null, max: number | null): string {
  const value = min ?? max;
  if (value == null) return "Unspecified";
  if (value < 10) return "$0-10/hr";
  if (value < 20) return "$10-20/hr";
  if (value < 30) return "$20-30/hr";
  if (value < 50) return "$30-50/hr";
  return "$50+/hr";
}

export const searchRouter = router({
  candidates: employerProcedure.input(searchInput).query(async ({ ctx, input }) => {
    const staff = await ctx.prisma.employerStaff.findUniqueOrThrow({
      where: { userId: ctx.session.user.id },
    });

    const where: Prisma.CandidateWhereInput = {
      isSearchable: true,
      // FRS §15: filters map to structured fields — industry is scoped via the candidate's
      // taxonomy usage, since Candidate itself has no direct industryId.
      OR: [
        { softwareInventory: { some: { software: { industryId: input.industryId } } } },
        { skillInventory: { some: { skill: { industryId: input.industryId } } } },
      ],
      ...(input.rateMin != null || input.rateMax != null
        ? {
            targetHourlyRateMin: input.rateMax != null ? { lte: input.rateMax } : undefined,
            targetHourlyRateMax: input.rateMin != null ? { gte: input.rateMin } : undefined,
          }
        : {}),
      ...(input.minWeeklyAvailability != null
        ? { weeklyAvailability: { gte: input.minWeeklyAvailability } }
        : {}),
      ...(input.softwareIds?.length
        ? {
            softwareInventory: {
              some: { softwareId: { in: input.softwareIds.map((s) => s.softwareId) } },
            },
          }
        : {}),
      ...(input.skillIds?.length
        ? { skillInventory: { some: { skillId: { in: input.skillIds } } } }
        : {}),
    };

    const [total, candidates] = await Promise.all([
      ctx.prisma.candidate.count({ where }),
      ctx.prisma.candidate.findMany({
        where,
        skip: (input.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          softwareInventory: { include: { software: true } },
          skillInventory: { include: { skill: true } },
          employmentHistory: true,
        },
      }),
    ]);

    const fullAccess = await canViewFullProfile(staff.id);

    if (!fullAccess) {
      return {
        mode: "preview" as const,
        count: total,
        sampleCards: candidates.map((c) => ({
          avatarUrl: null,
          topTags: [
            ...c.softwareInventory.slice(0, 2).map((s) => s.software.name),
            ...c.skillInventory.slice(0, 1).map((s) => s.skill.name),
          ],
          rateRangeBucket: rateRangeBucket(
            c.targetHourlyRateMin ? Number(c.targetHourlyRateMin) : null,
            c.targetHourlyRateMax ? Number(c.targetHourlyRateMax) : null,
          ),
        })),
      };
    }

    const results = await Promise.all(
      candidates.map(async (c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        avatarUrl: c.avatarUrl,
        employmentHistory: c.employmentHistory,
        software: c.softwareInventory.map((s) => ({
          name: s.software.name,
          proficiency: s.proficiency,
          yearsOfUsage: s.yearsOfUsage,
        })),
        matchScore: input.jobPostId ? await computeMatchScore(c.id, input.jobPostId) : null,
      })),
    );

    return { mode: "full" as const, results, total };
  }),

  compGuidanceForIndustry: employerProcedure
    .input(z.object({ industryId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const agg = await ctx.prisma.candidate.aggregate({
        where: {
          isSearchable: true,
          OR: [
            { softwareInventory: { some: { software: { industryId: input.industryId } } } },
            { skillInventory: { some: { skill: { industryId: input.industryId } } } },
          ],
        },
        _min: { targetHourlyRateMin: true },
        _max: { targetHourlyRateMax: true },
      });
      return {
        min: agg._min.targetHourlyRateMin ? Number(agg._min.targetHourlyRateMin) : null,
        max: agg._max.targetHourlyRateMax ? Number(agg._max.targetHourlyRateMax) : null,
      };
    }),
});
