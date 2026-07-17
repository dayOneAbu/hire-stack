import { describe, it, expect } from "vitest";
import { blendScore } from "./embeddings";

describe("blendScore", () => {
  it("weights similarity 0.6 and match score 0.4", () => {
    expect(blendScore(1, 0)).toBeCloseTo(0.6);
    expect(blendScore(0, 1)).toBeCloseTo(0.4);
    expect(blendScore(0.5, 0.5)).toBeCloseTo(0.5);
  });
});
