import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, candidateProcedure } from "@/server/trpc/trpc";
import { getResumeUploadUrl } from "@/lib/storage";
import { parseResume } from "@/server/services/resumeParser";

const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const MAX_PARSE_ATTEMPTS_PER_DAY = 5;

export const resumeRouter = router({
  getUploadUrl: candidateProcedure
    .input(
      z.object({
        filename: z.string().min(1),
        contentType: z.enum(ALLOWED_CONTENT_TYPES),
        sizeBytes: z.number().int().positive().max(MAX_RESUME_BYTES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const candidate = await ctx.prisma.candidate.findUniqueOrThrow({
        where: { userId: ctx.session.user.id },
      });
      return getResumeUploadUrl(candidate.id, input.filename);
    }),

  confirmUpload: candidateProcedure
    .input(z.object({ rawResumeUrl: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const candidate = await ctx.prisma.candidate.findUniqueOrThrow({
        where: { userId: ctx.session.user.id },
      });

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const attemptsToday = await ctx.prisma.auditTrail.count({
        where: { userId: ctx.session.user.id, action: "RESUME_PARSED", createdAt: { gte: since } },
      });
      if (attemptsToday >= MAX_PARSE_ATTEMPTS_PER_DAY) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Daily resume parse limit reached. Try again tomorrow.",
        });
      }

      await ctx.prisma.candidate.update({
        where: { id: candidate.id },
        data: { rawResumeUrl: input.rawResumeUrl, resumeParseStatus: "PENDING" },
      });
      await ctx.prisma.auditTrail.create({
        data: { userId: ctx.session.user.id, action: "RESUME_PARSED" },
      });

      // Fire-and-forget: parsing is async, never blocks this response (NFRS §1).
      void parseResume(candidate.id, input.rawResumeUrl);

      return { parseStatus: "PENDING" as const };
    }),

  status: candidateProcedure.query(async ({ ctx }) => {
    const candidate = await ctx.prisma.candidate.findUniqueOrThrow({
      where: { userId: ctx.session.user.id },
      select: { resumeParseStatus: true, isSearchable: true },
    });
    return { parseStatus: candidate.resumeParseStatus, isSearchable: candidate.isSearchable };
  }),
});
