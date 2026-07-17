import { describe, it, expect } from "vitest";
import { computeFunnel } from "./funnel";

describe("computeFunnel", () => {
  it("counts current stage occupancy per stage", () => {
    const result = computeFunnel(
      ["INBOX", "SCREENING", "HIRED"],
      [
        { currentStage: "INBOX", _count: { _all: 2 } },
        { currentStage: "HIRED", _count: { _all: 1 } },
      ],
      [],
    );
    expect(result).toEqual([
      { stage: "INBOX", count: 2, avgDaysInStage: null },
      { stage: "SCREENING", count: 0, avgDaysInStage: null },
      { stage: "HIRED", count: 1, avgDaysInStage: null },
    ]);
  });

  it("averages days spent in a stage across applications, from consecutive history rows", () => {
    // A row's (toStage, createdAt) marks when an application entered that stage; the
    // duration is measured up to the *next* row for the same application.
    const result = computeFunnel(
      ["INBOX", "SCREENING"],
      [],
      [
        { applicationId: "a", toStage: "SCREENING", createdAt: new Date("2026-01-03") },
        { applicationId: "a", toStage: "INTERVIEW", createdAt: new Date("2026-01-05") },
        { applicationId: "b", toStage: "SCREENING", createdAt: new Date("2026-01-05") },
        { applicationId: "b", toStage: "INTERVIEW", createdAt: new Date("2026-01-06") },
      ],
    );
    // "a" spent 2 days in SCREENING (Jan 3 -> Jan 5), "b" spent 1 day (Jan 5 -> Jan 6).
    expect(result.find((s) => s.stage === "SCREENING")?.avgDaysInStage).toBeCloseTo(1.5);
  });

  it("ignores an application's last history row (nothing follows it) for days-in-stage", () => {
    const result = computeFunnel(
      ["INBOX"],
      [],
      [{ applicationId: "a", toStage: "INBOX", createdAt: new Date("2026-01-01") }],
    );
    expect(result[0].avgDaysInStage).toBeNull();
  });
});
