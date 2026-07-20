import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeMatchScore } from "@/server/services/matchScore";
import { rankByRelevance } from "@/server/services/aiRanking";
import { verifyCronAuth } from "@/lib/cronAuth";

// Daily cron target: "new matches for you" (candidate) / "new candidates match your saved
// search" (employer) digest, FRS §20. Re-scores against jobs/candidates created in the last 24h
// only (not a full re-scan), same on-demand scoring path as the live UI, no separate batch job.
//
// ponytail: no email provider is wired into this stack yet (PRD §8 never picked one) — this
// computes and logs the digest payload instead of sending mail. Swap the console.log calls for
// a real send (e.g. Resend) once a provider is chosen.
export async function POST(request: Request) {
  const unauthorized = verifyCronAuth(request);
  if (unauthorized) return unauthorized;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const newJobPosts = await prisma.jobPost.findMany({
    where: { status: "ACTIVE", createdAt: { gte: since } },
  });

  let candidateDigests = 0;
  if (newJobPosts.length > 0) {
    const candidates = await prisma.candidate.findMany({ where: { isSearchable: true } });
    for (const candidate of candidates) {
      const scored = await Promise.all(
        newJobPosts.map(async (jobPost) => ({
          jobPost,
          overallScore: await computeMatchScore(candidate.id, jobPost.id),
        })),
      );
      const matches = rankByRelevance(scored).filter((m) => m.overallScore.overallMatchScore >= 50);
      if (matches.length === 0) continue;
      candidateDigests++;
      console.log(
        `[digest] candidate ${candidate.id}: ${matches.length} new matching job(s)`,
        matches.map((m) => ({ jobPostId: m.jobPost.id, score: m.overallScore.overallMatchScore })),
      );
    }
  }

  const newCandidates = await prisma.candidate.findMany({
    where: { isSearchable: true, createdAt: { gte: since } },
  });

  let employerDigests = 0;
  if (newCandidates.length > 0) {
    const savedSearches = await prisma.savedSearch.findMany();
    for (const savedSearch of savedSearches) {
      const filters = savedSearch.filters as Record<string, unknown>;
      const industryId = filters.industryId as string | undefined;
      if (!industryId) continue;

      const matches = await prisma.candidate.findMany({
        where: {
          id: { in: newCandidates.map((c) => c.id) },
          OR: [
            { softwareInventory: { some: { software: { industryId } } } },
            { skillInventory: { some: { skill: { industryId } } } },
          ],
        },
      });
      if (matches.length === 0) continue;
      employerDigests++;
      console.log(
        `[digest] savedSearch ${savedSearch.id} (workspace ${savedSearch.workspaceId}): ${matches.length} new matching candidate(s)`,
        matches.map((c) => c.id),
      );
    }
  }

  return NextResponse.json({ candidateDigests, employerDigests });
}
