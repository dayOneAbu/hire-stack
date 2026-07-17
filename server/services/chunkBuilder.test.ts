import { describe, it, expect } from "vitest";
import { buildCandidateChunks } from "./chunkBuilder";

describe("buildCandidateChunks", () => {
  it("emits one chunk per source that has content", () => {
    const chunks = buildCandidateChunks({
      bio: "Experienced VA.",
      employmentHistory: [
        { companyName: "Acme", jobTitle: "VA", startDate: new Date("2022-01-01"), endDate: null, description: "Handled inbox." },
      ],
      software: ["Slack"],
      skills: ["Scheduling"],
    });

    expect(chunks.map((c) => c.source)).toEqual(["bio", "employment", "inventory"]);
    expect(chunks[1].content).toContain("VA at Acme");
    expect(chunks[2].content).toContain("Slack");
    expect(chunks[2].content).toContain("Scheduling");
  });

  it("skips empty bio and empty inventory", () => {
    const chunks = buildCandidateChunks({
      bio: "  ",
      employmentHistory: [],
      software: [],
      skills: [],
    });

    expect(chunks).toEqual([]);
  });

  it("emits one employment chunk per period", () => {
    const chunks = buildCandidateChunks({
      bio: null,
      employmentHistory: [
        { companyName: "A", jobTitle: "X", startDate: new Date("2020-01-01"), endDate: new Date("2021-01-01"), description: null },
        { companyName: "B", jobTitle: "Y", startDate: new Date("2021-02-01"), endDate: null, description: null },
      ],
      software: [],
      skills: [],
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toContain("2020-01 to 2021-01");
    expect(chunks[1].content).toContain("present");
  });
});
