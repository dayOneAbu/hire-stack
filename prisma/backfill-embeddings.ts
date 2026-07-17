import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { refreshCandidateChunks, refreshJobPostEmbedding, refreshAnomalyEmbedding } from "@/server/services/embeddings";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const candidates = await prisma.candidate.findMany({ select: { id: true } });
  for (const c of candidates) {
    await refreshCandidateChunks(c.id);
  }
  console.log(`Backfilled chunks for ${candidates.length} candidates.`);

  const jobPosts = await prisma.jobPost.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  for (const j of jobPosts) {
    await refreshJobPostEmbedding(j.id);
  }
  console.log(`Backfilled embeddings for ${jobPosts.length} active job posts.`);

  const anomalies = await prisma.employmentAnomaly.findMany({
    where: { status: { in: ["RESOLVED_BY_CANDIDATE", "OVERRIDDEN_BY_ADMIN", "IGNORED"] } },
    select: { id: true },
  });
  for (const a of anomalies) {
    await refreshAnomalyEmbedding(a.id);
  }
  console.log(`Backfilled embeddings for ${anomalies.length} resolved anomalies.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
