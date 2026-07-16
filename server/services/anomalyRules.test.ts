import { describe, it, expect } from "vitest";
import { Prisma, type EmploymentPeriod } from "@prisma/client";
import {
  detectTimelineGap,
  detectConcurrentEmployers,
  detectMissingWageRange,
  detectFreelanceIndication,
  detectUnusualJobDuration,
  detectCriticalCertMissing,
  detectIncompleteEntry,
} from "./anomalyRules";

function period(overrides: Partial<EmploymentPeriod> = {}): EmploymentPeriod {
  return {
    id: "p1",
    candidateId: "c1",
    companyName: "Acme Realty",
    jobTitle: "VA",
    startDate: new Date("2022-01-01"),
    endDate: new Date("2022-06-01"),
    description: null,
    documentedHourlyRate: null,
    employmentType: null,
    isUserVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("detectTimelineGap", () => {
  it("flags a gap >= 60 days between periods", () => {
    const a = period({ id: "a", startDate: new Date("2022-01-01"), endDate: new Date("2022-03-01") });
    const b = period({ id: "b", startDate: new Date("2022-06-01"), endDate: new Date("2022-09-01") });
    const result = detectTimelineGap([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].employmentPeriodId).toBe("a");
  });

  it("does not flag a gap under 60 days", () => {
    const a = period({ id: "a", startDate: new Date("2022-01-01"), endDate: new Date("2022-03-01") });
    const b = period({ id: "b", startDate: new Date("2022-03-15"), endDate: new Date("2022-09-01") });
    expect(detectTimelineGap([a, b])).toHaveLength(0);
  });
});

describe("detectConcurrentEmployers", () => {
  it("flags two periods with overlapping date ranges", () => {
    const a = period({ id: "a", startDate: new Date("2022-01-01"), endDate: new Date("2022-06-01") });
    const b = period({ id: "b", startDate: new Date("2022-03-01"), endDate: new Date("2022-09-01") });
    const result = detectConcurrentEmployers([a, b]);
    expect(result).toHaveLength(2);
  });

  it("does not flag non-overlapping periods", () => {
    const a = period({ id: "a", startDate: new Date("2022-01-01"), endDate: new Date("2022-06-01") });
    const b = period({ id: "b", startDate: new Date("2022-07-01"), endDate: new Date("2022-09-01") });
    expect(detectConcurrentEmployers([a, b])).toHaveLength(0);
  });
});

describe("detectMissingWageRange", () => {
  it("flags when no rate and no wage text", () => {
    expect(detectMissingWageRange(period({ documentedHourlyRate: null, description: "Did admin work" }))).toHaveLength(1);
  });

  it("does not flag when documentedHourlyRate present", () => {
    expect(
      detectMissingWageRange(period({ documentedHourlyRate: new Prisma.Decimal(15) })),
    ).toHaveLength(0);
  });

  it("does not flag when wage text present", () => {
    expect(detectMissingWageRange(period({ description: "Paid $15/hour" }))).toHaveLength(0);
  });
});

describe("detectFreelanceIndication", () => {
  it("flags freelance keyword in title/description", () => {
    const p = period({ jobTitle: "Freelance VA" });
    expect(detectFreelanceIndication(p, [p])).toHaveLength(1);
  });

  it("flags company reused across 3+ periods", () => {
    const all = [
      period({ id: "a", companyName: "Same Co" }),
      period({ id: "b", companyName: "Same Co" }),
      period({ id: "c", companyName: "Same Co" }),
    ];
    expect(detectFreelanceIndication(all[0], all)).toHaveLength(1);
  });

  it("does not flag a normal single employer", () => {
    const p = period({ jobTitle: "Executive Assistant", companyName: "Acme" });
    expect(detectFreelanceIndication(p, [p])).toHaveLength(0);
  });
});

describe("detectUnusualJobDuration", () => {
  it("flags duration under 30 days", () => {
    const p = period({ startDate: new Date("2022-01-01"), endDate: new Date("2022-01-10") });
    expect(detectUnusualJobDuration(p)).toHaveLength(1);
  });

  it("flags duration over 15 years", () => {
    const p = period({ startDate: new Date("2000-01-01"), endDate: new Date("2020-01-01") });
    expect(detectUnusualJobDuration(p)).toHaveLength(1);
  });

  it("does not flag a normal duration", () => {
    const p = period({ startDate: new Date("2022-01-01"), endDate: new Date("2022-06-01") });
    expect(detectUnusualJobDuration(p)).toHaveLength(0);
  });
});

describe("detectCriticalCertMissing", () => {
  it("flags when cert keyword present in text", () => {
    expect(detectCriticalCertMissing(period({ description: "Licensed real estate agent" }))).toHaveLength(1);
  });

  it("does not flag when no cert keyword", () => {
    expect(detectCriticalCertMissing(period({ description: "Handled scheduling" }))).toHaveLength(0);
  });
});

describe("detectIncompleteEntry", () => {
  it("flags missing job title", () => {
    expect(detectIncompleteEntry(period({ jobTitle: "" }))).toHaveLength(1);
  });

  it("does not flag a complete entry", () => {
    expect(detectIncompleteEntry(period())).toHaveLength(0);
  });
});
