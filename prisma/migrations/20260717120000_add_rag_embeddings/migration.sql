-- Additive only: pgvector extension + RAG chunk/embedding tables (W3 foundation).
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "EmploymentAnomaly" ADD COLUMN     "embedding" vector(2048);

-- CreateTable
CREATE TABLE "CandidateChunk" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidateId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(2048),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPostEmbedding" (
    "jobPostId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(2048),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPostEmbedding_pkey" PRIMARY KEY ("jobPostId")
);

-- CreateIndex
CREATE INDEX "CandidateChunk_candidateId_idx" ON "CandidateChunk"("candidateId");

-- AddForeignKey
ALTER TABLE "CandidateChunk" ADD CONSTRAINT "CandidateChunk_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPostEmbedding" ADD CONSTRAINT "JobPostEmbedding_jobPostId_fkey" FOREIGN KEY ("jobPostId") REFERENCES "JobPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
