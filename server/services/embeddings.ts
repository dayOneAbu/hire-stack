import { prisma } from "@/lib/prisma";
import { embedTexts } from "@/lib/ai";
import { buildCandidateChunks } from "./chunkBuilder";

// pgvector accepts vector literals as "[0.1,0.2,...]" text — Prisma has no native vector type.
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function refreshCandidateChunks(candidateId: string): Promise<void> {
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: {
      employmentHistory: true,
      softwareInventory: { include: { software: true } },
      skillInventory: { include: { skill: true } },
    },
  });

  const chunks = buildCandidateChunks({
    bio: candidate.bio,
    employmentHistory: candidate.employmentHistory,
    software: candidate.softwareInventory.map((s) => s.software.name),
    skills: candidate.skillInventory.map((s) => s.skill.name),
  });

  await prisma.candidateChunk.deleteMany({ where: { candidateId } });
  if (chunks.length === 0) return;

  const embeddings = await embedTexts(
    chunks.map((c) => c.content),
    "passage",
  );

  await prisma.$transaction(
    chunks.map((chunk, i) =>
      prisma.$executeRaw`
        INSERT INTO "CandidateChunk" (id, "candidateId", source, content, embedding)
        VALUES (gen_random_uuid(), ${candidateId}::uuid, ${chunk.source}, ${chunk.content}, ${toVectorLiteral(embeddings[i])}::vector)
      `,
    ),
  );
}

export async function refreshJobPostEmbedding(jobPostId: string): Promise<void> {
  const jobPost = await prisma.jobPost.findUniqueOrThrow({
    where: { id: jobPostId },
    include: { requiredSoftware: { include: { software: true } }, requiredSkills: { include: { skill: true } } },
  });

  const parts = [jobPost.title, jobPost.description];
  if (jobPost.requiredSoftware.length > 0) {
    parts.push(`Software: ${jobPost.requiredSoftware.map((s) => s.software.name).join(", ")}.`);
  }
  if (jobPost.requiredSkills.length > 0) {
    parts.push(`Skills: ${jobPost.requiredSkills.map((s) => s.skill.name).join(", ")}.`);
  }
  const content = parts.join(" ");

  const [embedding] = await embedTexts([content], "passage");
  const literal = toVectorLiteral(embedding);

  await prisma.$executeRaw`
    INSERT INTO "JobPostEmbedding" ("jobPostId", content, embedding, "updatedAt")
    VALUES (${jobPostId}::uuid, ${content}, ${literal}::vector, now())
    ON CONFLICT ("jobPostId") DO UPDATE SET content = ${content}, embedding = ${literal}::vector, "updatedAt" = now()
  `;
}

export async function refreshAnomalyEmbedding(anomalyId: string): Promise<void> {
  const anomaly = await prisma.employmentAnomaly.findUniqueOrThrow({ where: { id: anomalyId } });
  const content = [anomaly.systemNote, anomaly.candidateAnswer].filter(Boolean).join(" ");
  if (!content.trim()) return;

  const [embedding] = await embedTexts([content], "passage");
  const literal = toVectorLiteral(embedding);

  await prisma.$executeRaw`
    UPDATE "EmploymentAnomaly" SET embedding = ${literal}::vector WHERE id = ${anomalyId}::uuid
  `;
}

export type ChunkMatch = {
  candidateId: string;
  source: string;
  content: string;
  similarity: number;
};

// Best-matching chunk per searchable candidate, ranked by cosine distance ascending
// (pgvector `<=>` is distance; similarity = 1 - distance).
export async function searchCandidateChunks(
  queryEmbedding: number[],
  limit: number,
): Promise<ChunkMatch[]> {
  const literal = toVectorLiteral(queryEmbedding);

  return prisma.$queryRaw<ChunkMatch[]>`
    SELECT DISTINCT ON (cc."candidateId")
      cc."candidateId" AS "candidateId",
      cc.source,
      cc.content,
      1 - (cc.embedding <=> ${literal}::vector) AS similarity
    FROM "CandidateChunk" cc
    JOIN "Candidate" c ON c.id = cc."candidateId"
    WHERE c."isSearchable" = true AND cc.embedding IS NOT NULL
    ORDER BY cc."candidateId", cc.embedding <=> ${literal}::vector ASC
    LIMIT ${limit}
  `;
}

export async function topChunksForCandidate(
  candidateId: string,
  queryEmbedding: number[],
  limit: number,
): Promise<Array<{ source: string; content: string }>> {
  const literal = toVectorLiteral(queryEmbedding);

  return prisma.$queryRaw<Array<{ source: string; content: string }>>`
    SELECT source, content
    FROM "CandidateChunk"
    WHERE "candidateId" = ${candidateId}::uuid AND embedding IS NOT NULL
    ORDER BY embedding <=> ${literal}::vector ASC
    LIMIT ${limit}
  `;
}

export async function meanCandidateEmbedding(candidateId: string): Promise<number[] | null> {
  const rows = await prisma.$queryRaw<Array<{ embedding: string | null }>>`
    SELECT AVG(embedding)::text AS embedding
    FROM "CandidateChunk"
    WHERE "candidateId" = ${candidateId}::uuid AND embedding IS NOT NULL
  `;
  const raw = rows[0]?.embedding;
  if (!raw) return null;
  // pgvector returns "[0.1,0.2,...]" as text when cast — parse back to a number array.
  return raw
    .slice(1, -1)
    .split(",")
    .map(Number);
}

export type JobMatch = { jobPostId: string; similarity: number };

export async function searchJobPosts(candidateEmbedding: number[], limit: number): Promise<JobMatch[]> {
  const literal = toVectorLiteral(candidateEmbedding);

  return prisma.$queryRaw<JobMatch[]>`
    SELECT jpe."jobPostId" AS "jobPostId", 1 - (jpe.embedding <=> ${literal}::vector) AS similarity
    FROM "JobPostEmbedding" jpe
    JOIN "JobPost" jp ON jp.id = jpe."jobPostId"
    WHERE jp.status = 'ACTIVE' AND jpe.embedding IS NOT NULL
    ORDER BY jpe.embedding <=> ${literal}::vector ASC
    LIMIT ${limit}
  `;
}

export type AnomalyMatch = {
  id: string;
  systemNote: string;
  candidateAnswer: string | null;
  status: string;
  similarity: number;
};

export async function searchSimilarResolvedAnomalies(
  queryEmbedding: number[],
  limit: number,
): Promise<AnomalyMatch[]> {
  const literal = toVectorLiteral(queryEmbedding);

  return prisma.$queryRaw<AnomalyMatch[]>`
    SELECT id, "systemNote", "candidateAnswer", status,
      1 - (embedding <=> ${literal}::vector) AS similarity
    FROM "EmploymentAnomaly"
    WHERE status IN ('RESOLVED_BY_CANDIDATE', 'OVERRIDDEN_BY_ADMIN', 'IGNORED')
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${literal}::vector ASC
    LIMIT ${limit}
  `;
}

// Blend formula for employer semantic search (RAG plan §3B.1): weight raw
// text-similarity against the deterministic FRS §10 match score, both 0..1.
export function blendScore(similarity: number, normalizedMatchScore: number): number {
  return 0.6 * similarity + 0.4 * normalizedMatchScore;
}
