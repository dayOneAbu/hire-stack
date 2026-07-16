import type { EmploymentPeriod } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;
const TIMELINE_GAP_DAYS = 60;
const MIN_DURATION_DAYS = 30;
const MAX_DURATION_YEARS = 15;
const FREELANCE_KEYWORDS = /freelance|contract|multi-?client|gig work/i;
const CERT_KEYWORDS = /certifi(ed|cation)|licens(e|ed)/i;

export type NewAnomaly = {
  employmentPeriodId: string;
  ruleType:
    | "TIMELINE_GAP"
    | "CONCURRENT_EMPLOYERS"
    | "MISSING_WAGE_RANGE"
    | "FREELANCE_INDICATION"
    | "UNUSUAL_JOB_DURATION"
    | "CRITICAL_CERT_MISSING"
    | "INCOMPLETE_ENTRY";
  confidenceScore: number;
  systemNote: string;
  status: "PENDING_CANDIDATE";
};

function sortedByStart(periods: EmploymentPeriod[]) {
  return [...periods].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

function periodEnd(period: EmploymentPeriod): number {
  return period.endDate ? period.endDate.getTime() : Date.now();
}

export function detectTimelineGap(periods: EmploymentPeriod[]): NewAnomaly[] {
  const sorted = sortedByStart(periods);
  const anomalies: NewAnomaly[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const end = periodEnd(sorted[i]);
    const nextStart = sorted[i + 1].startDate.getTime();
    const gapDays = (nextStart - end) / DAY_MS;
    if (gapDays >= TIMELINE_GAP_DAYS) {
      anomalies.push({
        employmentPeriodId: sorted[i].id,
        ruleType: "TIMELINE_GAP",
        confidenceScore: 1,
        systemNote: `Gap of ~${Math.round(gapDays)} days before next employment period.`,
        status: "PENDING_CANDIDATE",
      });
    }
  }
  return anomalies;
}

export function detectConcurrentEmployers(periods: EmploymentPeriod[]): NewAnomaly[] {
  const anomalies: NewAnomaly[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      const a = periods[i];
      const b = periods[j];
      const overlap = a.startDate.getTime() < periodEnd(b) && b.startDate.getTime() < periodEnd(a);
      if (overlap) {
        for (const p of [a, b]) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            anomalies.push({
              employmentPeriodId: p.id,
              ruleType: "CONCURRENT_EMPLOYERS",
              confidenceScore: 1,
              systemNote: "Overlaps in date range with another employment period.",
              status: "PENDING_CANDIDATE",
            });
          }
        }
      }
    }
  }
  return anomalies;
}

export function detectMissingWageRange(period: EmploymentPeriod): NewAnomaly[] {
  if (period.documentedHourlyRate != null) return [];
  const hasWageText = period.description ? /\$\s?\d|\bhour(ly)?\b.*rate/i.test(period.description) : false;
  if (hasWageText) return [];
  return [
    {
      employmentPeriodId: period.id,
      ruleType: "MISSING_WAGE_RANGE",
      confidenceScore: 1,
      systemNote: "No documented hourly rate or wage text found.",
      status: "PENDING_CANDIDATE",
    },
  ];
}

export function detectFreelanceIndication(
  period: EmploymentPeriod,
  allPeriods: EmploymentPeriod[],
): NewAnomaly[] {
  const text = `${period.jobTitle} ${period.description ?? ""}`;
  const hasKeyword = FREELANCE_KEYWORDS.test(text);
  const sameCompanyCount = allPeriods.filter((p) => p.companyName === period.companyName).length;
  const reusedAcrossMany = sameCompanyCount >= 3;
  if (!hasKeyword && !reusedAcrossMany) return [];
  return [
    {
      employmentPeriodId: period.id,
      ruleType: "FREELANCE_INDICATION",
      confidenceScore: hasKeyword ? 0.9 : 0.7,
      systemNote: hasKeyword
        ? "Freelance/contract/multi-client language detected."
        : `Company name reused across ${sameCompanyCount} periods with distinct date ranges.`,
      status: "PENDING_CANDIDATE",
    },
  ];
}

export function detectUnusualJobDuration(period: EmploymentPeriod): NewAnomaly[] {
  const durationDays = (periodEnd(period) - period.startDate.getTime()) / DAY_MS;
  const tooShort = durationDays < MIN_DURATION_DAYS;
  const tooLong = durationDays > MAX_DURATION_YEARS * 365;
  if (!tooShort && !tooLong) return [];
  return [
    {
      employmentPeriodId: period.id,
      ruleType: "UNUSUAL_JOB_DURATION",
      confidenceScore: 0.8,
      systemNote: tooShort
        ? `Duration of ~${Math.round(durationDays)} days is under 30 days.`
        : `Duration of ~${Math.round(durationDays / 365)} years exceeds 15 years.`,
      status: "PENDING_CANDIDATE",
    },
  ];
}

export function detectCriticalCertMissing(period: EmploymentPeriod): NewAnomaly[] {
  if (!period.description || !CERT_KEYWORDS.test(period.description)) return [];
  return [
    {
      employmentPeriodId: period.id,
      ruleType: "CRITICAL_CERT_MISSING",
      confidenceScore: 0.6,
      systemNote: "Certification/license referenced in text but not captured as structured data.",
      status: "PENDING_CANDIDATE",
    },
  ];
}

export function detectIncompleteEntry(period: EmploymentPeriod): NewAnomaly[] {
  const missingTitle = !period.jobTitle;
  const missingStart = !period.startDate;
  if (!missingTitle && !missingStart) return [];
  return [
    {
      employmentPeriodId: period.id,
      ruleType: "INCOMPLETE_ENTRY",
      confidenceScore: 1,
      systemNote: "Missing job title and/or start date.",
      status: "PENDING_CANDIDATE",
    },
  ];
}

export function runAnomalyRules(periods: EmploymentPeriod[]): NewAnomaly[] {
  const anomalies: NewAnomaly[] = [
    ...detectTimelineGap(periods),
    ...detectConcurrentEmployers(periods),
  ];
  for (const period of periods) {
    anomalies.push(
      ...detectMissingWageRange(period),
      ...detectFreelanceIndication(period, periods),
      ...detectUnusualJobDuration(period),
      ...detectCriticalCertMissing(period),
      ...detectIncompleteEntry(period),
    );
  }
  return anomalies;
}
