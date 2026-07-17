import { describe, it, expect } from "vitest";
import { canWithdraw } from "./applicationWithdraw";

describe("canWithdraw", () => {
  it("allows withdraw from INBOX on a candidate-applied application", () => {
    expect(canWithdraw({ currentStage: "INBOX", source: "CANDIDATE_APPLIED" })).toBe(true);
  });

  it("blocks withdraw once the employer has moved the application past INBOX", () => {
    expect(canWithdraw({ currentStage: "SCREENING", source: "CANDIDATE_APPLIED" })).toBe(false);
  });

  it("blocks withdraw when the employer added the candidate, not the candidate applying", () => {
    expect(canWithdraw({ currentStage: "INBOX", source: "EMPLOYER_ADDED" })).toBe(false);
  });
});
