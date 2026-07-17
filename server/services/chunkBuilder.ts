// Chunks come from structured verified data only — raw resume text is never stored (FRS §3).
// Pure so it's testable without touching embedTexts or the DB.

export type ChunkSource = "bio" | "employment" | "inventory";

export type ChunkInput = {
  bio: string | null;
  employmentHistory: Array<{
    companyName: string;
    jobTitle: string;
    startDate: Date;
    endDate: Date | null;
    description: string | null;
  }>;
  software: string[];
  skills: string[];
};

export type Chunk = { source: ChunkSource; content: string };

function formatPeriod(p: ChunkInput["employmentHistory"][number]): string {
  const start = p.startDate.toISOString().slice(0, 7);
  const end = p.endDate ? p.endDate.toISOString().slice(0, 7) : "present";
  const desc = p.description ? ` ${p.description}` : "";
  return `${p.jobTitle} at ${p.companyName} (${start} to ${end}).${desc}`;
}

export function buildCandidateChunks(input: ChunkInput): Chunk[] {
  const chunks: Chunk[] = [];

  if (input.bio?.trim()) {
    chunks.push({ source: "bio", content: input.bio.trim() });
  }

  for (const period of input.employmentHistory) {
    chunks.push({ source: "employment", content: formatPeriod(period) });
  }

  if (input.software.length > 0 || input.skills.length > 0) {
    const parts = [];
    if (input.software.length > 0) parts.push(`Software: ${input.software.join(", ")}.`);
    if (input.skills.length > 0) parts.push(`Skills: ${input.skills.join(", ")}.`);
    chunks.push({ source: "inventory", content: parts.join(" ") });
  }

  return chunks;
}
