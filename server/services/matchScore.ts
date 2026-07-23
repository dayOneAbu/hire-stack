import { prisma } from "@/lib/prisma";
import type { CandidateSoftware, EmploymentPeriod, JobRequiredSoftware, Proficiency } from "@prisma/client";

const PROFICIENCY_RANK: Record<Proficiency, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

export type MatchScoreBreakdown = {
  softwareScore: number;
  experienceScore: number;
  compScore: number;
  availabilityScore: number;
  overallMatchScore: number;
};

type MatchScoreInput = {
  candidateSoftware: CandidateSoftware[];
  employmentHistory: EmploymentPeriod[];
  targetHourlyRateMin: number | null;
  targetHourlyRateMax: number | null;
  weeklyAvailability: number;
  requiredSoftware: JobRequiredSoftware[];
  jobTargetRateMin: number | null;
  jobTargetRateMax: number | null;
  requiredHoursMin: number;
};

function toInt100(fraction: number): number {
  return Math.round(Math.max(0, Math.min(1, fraction)) * 100);
}

// FRS §10 weighted formula, pure so it's independently testable.
export function scoreMatch(input: MatchScoreInput): MatchScoreBreakdown {
  // softwareScore: sum of matched requirements weighted by proficiency-met/required, over total required.
  let softwareScore = 1;
  if (input.requiredSoftware.length > 0) {
    const inventoryBySoftware = new Map(input.candidateSoftware.map((s) => [s.softwareId, s]));
    const matchedFraction = input.requiredSoftware.reduce((sum, req) => {
      const held = inventoryBySoftware.get(req.softwareId);
      if (!held) return sum;
      const met = Math.min(1, PROFICIENCY_RANK[held.proficiency] / PROFICIENCY_RANK[req.minProficiency]);
      return sum + met;
    }, 0);
    softwareScore = matchedFraction / input.requiredSoftware.length;
  }

  // experienceScore: total years worked against a flat 2-year baseline (FRS has no per-job years field).
  const totalYears = input.employmentHistory.reduce((sum, period) => {
    const end = period.endDate ?? new Date();
    const years = (end.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return sum + Math.max(0, years);
  }, 0);
  const experienceScore = Math.min(1, totalYears / 2);

  // compScore: 1 if ranges overlap, else linear falloff to 0 at 2x the gap between ranges.
  let compScore = 1;
  const { targetHourlyRateMin: cMin, targetHourlyRateMax: cMax, jobTargetRateMin: jMin, jobTargetRateMax: jMax } = input;
  if (cMin != null && cMax != null && jMin != null && jMax != null) {
    const overlaps = cMin <= jMax && jMin <= cMax;
    if (!overlaps) {
      const gap = cMin > jMax ? cMin - jMax : jMin - cMax;
      const jobRangeWidth = Math.max(1, jMax - jMin);
      compScore = Math.max(0, 1 - gap / (2 * jobRangeWidth));
    }
  }

  const availabilityScore = Math.min(1, input.weeklyAvailability / input.requiredHoursMin);

  const overall =
    0.35 * softwareScore + 0.3 * experienceScore + 0.2 * compScore + 0.15 * availabilityScore;

  return {
    softwareScore: toInt100(softwareScore),
    experienceScore: toInt100(experienceScore),
    compScore: toInt100(compScore),
    availabilityScore: toInt100(availabilityScore),
    overallMatchScore: toInt100(overall),
  };
}

export async function computeMatchScore(
  candidateId: string,
  jobPostId: string,
): Promise<MatchScoreBreakdown> {
  const [candidate, jobPost] = await Promise.all([
    prisma.candidate.findUniqueOrThrow({
      where: { id: candidateId },
      include: { softwareInventory: true, employmentHistory: true },
    }),
    prisma.jobPost.findUniqueOrThrow({
      where: { id: jobPostId },
      include: { requiredSoftware: true },
    }),
  ]);

  return scoreMatch({
    candidateSoftware: candidate.softwareInventory,
    employmentHistory: candidate.employmentHistory,
    targetHourlyRateMin: candidate.targetHourlyRateMin ? Number(candidate.targetHourlyRateMin) : null,
    targetHourlyRateMax: candidate.targetHourlyRateMax ? Number(candidate.targetHourlyRateMax) : null,
    weeklyAvailability: candidate.weeklyAvailability,
    requiredSoftware: jobPost.requiredSoftware,
    jobTargetRateMin: jobPost.targetRateMin ? Number(jobPost.targetRateMin) : null,
    jobTargetRateMax: jobPost.targetRateMax ? Number(jobPost.targetRateMax) : null,
    requiredHoursMin: jobPost.requiredHoursMin,
  });
}

// Same as computeMatchScore but fetches the candidate once and reuses it across every
// jobPost, instead of one findUniqueOrThrow per job — avoids N+1 round-trips when scoring
// a candidate against many active job posts at once (e.g. candidate.jobs.matched).
export async function computeMatchScoresForCandidate(
  candidateId: string,
  jobPosts: Array<{ id: string; requiredSoftware: JobRequiredSoftware[]; targetRateMin: unknown; targetRateMax: unknown; requiredHoursMin: number }>,
): Promise<Map<string, MatchScoreBreakdown>> {
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: { softwareInventory: true, employmentHistory: true },
  });

  const base = {
    candidateSoftware: candidate.softwareInventory,
    employmentHistory: candidate.employmentHistory,
    targetHourlyRateMin: candidate.targetHourlyRateMin ? Number(candidate.targetHourlyRateMin) : null,
    targetHourlyRateMax: candidate.targetHourlyRateMax ? Number(candidate.targetHourlyRateMax) : null,
    weeklyAvailability: candidate.weeklyAvailability,
  };

  return new Map(
    jobPosts.map((jobPost) => [
      jobPost.id,
      scoreMatch({
        ...base,
        requiredSoftware: jobPost.requiredSoftware,
        jobTargetRateMin: jobPost.targetRateMin != null ? Number(jobPost.targetRateMin) : null,
        jobTargetRateMax: jobPost.targetRateMax != null ? Number(jobPost.targetRateMax) : null,
        requiredHoursMin: jobPost.requiredHoursMin,
      }),
    ]),
  );
}

// Mirror of computeMatchScoresForCandidate for the opposite shape: one job post scored
// against many candidates (employer search results) — fetches the job post once instead
// of once per candidate.
export async function computeMatchScoresForJobPost(
  jobPostId: string,
  candidates: Array<{
    id: string;
    softwareInventory: CandidateSoftware[];
    employmentHistory: EmploymentPeriod[];
    targetHourlyRateMin: unknown;
    targetHourlyRateMax: unknown;
    weeklyAvailability: number;
  }>,
): Promise<Map<string, MatchScoreBreakdown>> {
  const jobPost = await prisma.jobPost.findUniqueOrThrow({
    where: { id: jobPostId },
    include: { requiredSoftware: true },
  });

  const base = {
    requiredSoftware: jobPost.requiredSoftware,
    jobTargetRateMin: jobPost.targetRateMin != null ? Number(jobPost.targetRateMin) : null,
    jobTargetRateMax: jobPost.targetRateMax != null ? Number(jobPost.targetRateMax) : null,
    requiredHoursMin: jobPost.requiredHoursMin,
  };

  return new Map(
    candidates.map((c) => [
      c.id,
      scoreMatch({
        ...base,
        candidateSoftware: c.softwareInventory,
        employmentHistory: c.employmentHistory,
        targetHourlyRateMin: c.targetHourlyRateMin != null ? Number(c.targetHourlyRateMin) : null,
        targetHourlyRateMax: c.targetHourlyRateMax != null ? Number(c.targetHourlyRateMax) : null,
        weeklyAvailability: c.weeklyAvailability,
      }),
    ]),
  );
}
