import { prisma } from "@/lib/prisma";

const FUZZY_MATCH_THRESHOLD = 0.8;

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Standard edit-distance similarity — hand-rolled, no new dependency needed for ~15 lines.
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export async function matchOrSuggestSoftware(
  name: string,
  industryId: string,
): Promise<{ softwareId: string; isNew: boolean }> {
  const slug = slugify(name);
  const candidates = await prisma.software.findMany({ where: { industryId } });

  let best: { id: string; score: number } | null = null;
  for (const candidate of candidates) {
    const score = similarity(slug, candidate.normalizedSlug);
    if (score >= FUZZY_MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { id: candidate.id, score };
    }
  }
  if (best) return { softwareId: best.id, isNew: false };

  const created = await prisma.software.create({
    data: { name, normalizedSlug: slug, industryId, status: "SUGGESTED_BY_AI" },
  });
  return { softwareId: created.id, isNew: true };
}
