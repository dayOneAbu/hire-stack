import { describe, it, expect } from "vitest";
import type { CandidateSoftware, EmploymentPeriod, JobRequiredSoftware } from "@prisma/client";
import { scoreMatch } from "./matchScore";

function period(overrides: Partial<EmploymentPeriod> = {}): EmploymentPeriod {
  return {
    id: "p1",
    candidateId: "c1",
    companyName: "Acme Realty",
    jobTitle: "VA",
    startDate: new Date("2022-01-01"),
    endDate: new Date("2024-01-01"),
    description: null,
    documentedHourlyRate: null,
    employmentType: null,
    isUserVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function candidateSoftware(overrides: Partial<CandidateSoftware> = {}): CandidateSoftware {
  return {
    candidateId: "c1",
    softwareId: "s1",
    proficiency: "INTERMEDIATE",
    yearsOfUsage: 2,
    isCurrentlyUsed: true,
    ...overrides,
  };
}

function requiredSoftware(overrides: Partial<JobRequiredSoftware> = {}): JobRequiredSoftware {
  return {
    jobPostId: "j1",
    softwareId: "s1",
    minProficiency: "INTERMEDIATE",
    isMandatory: true,
    ...overrides,
  };
}

const baseInput = {
  candidateSoftware: [candidateSoftware()],
  employmentHistory: [period()],
  targetHourlyRateMin: 10,
  targetHourlyRateMax: 15,
  weeklyAvailability: 40,
  requiredSoftware: [requiredSoftware()],
  jobTargetRateMin: 10,
  jobTargetRateMax: 15,
  requiredHoursMin: 40,
};

describe("scoreMatch", () => {
  it("perfect match scores 100 across the board", () => {
    const result = scoreMatch(baseInput);
    expect(result.softwareScore).toBe(100);
    expect(result.experienceScore).toBe(100);
    expect(result.compScore).toBe(100);
    expect(result.availabilityScore).toBe(100);
    expect(result.overallMatchScore).toBe(100);
  });

  it("zero match scores 0 across the board", () => {
    const result = scoreMatch({
      candidateSoftware: [],
      employmentHistory: [],
      targetHourlyRateMin: 5,
      targetHourlyRateMax: 5,
      weeklyAvailability: 0,
      requiredSoftware: [requiredSoftware()],
      jobTargetRateMin: 50,
      jobTargetRateMax: 60,
      requiredHoursMin: 40,
    });
    expect(result.softwareScore).toBe(0);
    expect(result.experienceScore).toBe(0);
    expect(result.availabilityScore).toBe(0);
    expect(result.compScore).toBe(0); // gap=45, jobRangeWidth=10, past 2x width falloff
    expect(result.overallMatchScore).toBe(0);
  });

  it("partial software match: proficiency below required scores proportionally", () => {
    const result = scoreMatch({
      ...baseInput,
      candidateSoftware: [candidateSoftware({ proficiency: "BEGINNER" })],
      requiredSoftware: [requiredSoftware({ minProficiency: "EXPERT" })],
    });
    expect(result.softwareScore).toBe(25); // 1/4
  });

  it("no required software defaults softwareScore to full", () => {
    const result = scoreMatch({ ...baseInput, requiredSoftware: [] });
    expect(result.softwareScore).toBe(100);
  });

  it("comp ranges overlap: full comp score", () => {
    const result = scoreMatch({ ...baseInput, targetHourlyRateMin: 12, targetHourlyRateMax: 20, jobTargetRateMin: 10, jobTargetRateMax: 15 });
    expect(result.compScore).toBe(100);
  });

  it("comp ranges disjoint: falls off proportionally to the gap relative to job range width", () => {
    // job offers 10-15 (width=5), candidate wants 20-25 → gap = 20-15 = 5 = width, falloff at 2x width → score 0.5
    const result = scoreMatch({ ...baseInput, targetHourlyRateMin: 20, targetHourlyRateMax: 25, jobTargetRateMin: 10, jobTargetRateMax: 15 });
    expect(result.compScore).toBe(50);
  });

  it("comp score strictly decreases as the gap grows, and hits 0", () => {
    const scoreAt = (candidateMin: number) =>
      scoreMatch({
        ...baseInput,
        targetHourlyRateMin: candidateMin,
        targetHourlyRateMax: candidateMin + 5,
        jobTargetRateMin: 10,
        jobTargetRateMax: 15,
      }).compScore;

    const scores = [16, 18, 20, 25].map(scoreAt);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1]);
    }
    expect(scoreAt(30)).toBe(0);
  });

  it("missing comp data on either side defaults to full comp score", () => {
    const result = scoreMatch({ ...baseInput, targetHourlyRateMin: null, targetHourlyRateMax: null });
    expect(result.compScore).toBe(100);
  });

  it("availability capped at 1 when candidate exceeds job requirement", () => {
    const result = scoreMatch({ ...baseInput, weeklyAvailability: 80, requiredHoursMin: 40 });
    expect(result.availabilityScore).toBe(100);
  });

  it("overall score applies the 0.35/0.30/0.20/0.15 weights", () => {
    const result = scoreMatch({
      ...baseInput,
      candidateSoftware: [],
      requiredSoftware: [requiredSoftware()],
    });
    // softwareScore=0, experience=100, comp=100, availability=100 -> 0 + 30 + 20 + 15 = 65
    expect(result.overallMatchScore).toBe(65);
  });
});
