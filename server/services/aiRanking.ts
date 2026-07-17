import type { MatchScoreBreakdown } from "@/server/services/matchScore";

// ponytail: advisory re-sort by score + sub-score tie-breakers, no LLM round-trip. Swap the
// comparator for a real aiClient re-rank call later if score-sort ties aren't granular enough —
// see FRS §20. Never touches overallMatchScore, never reorders items in/out of the input set.
export function rankByRelevance<T extends { overallScore: MatchScoreBreakdown }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const s = a.overallScore;
    const t = b.overallScore;
    return (
      t.overallMatchScore - s.overallMatchScore ||
      t.softwareScore - s.softwareScore ||
      t.experienceScore - s.experienceScore ||
      t.availabilityScore - s.availabilityScore
    );
  });
}
