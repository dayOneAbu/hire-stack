import { prisma } from "@/lib/prisma";

// isSearchable is derived, never manually toggled (FRS §4.3). Call this after
// any mutation that resolves/flags an EmploymentAnomaly.
export async function recomputeIsSearchable(candidateId: string): Promise<boolean> {
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: { user: true },
  });

  const openAnomalies = await prisma.employmentAnomaly.count({
    where: {
      employmentPeriod: { candidateId },
      status: { in: ["PENDING_CANDIDATE", "FLAGGED_FOR_ADMIN_REVIEW"] },
    },
  });

  const isSearchable = openAnomalies === 0 && candidate.user.emailVerified;

  if (isSearchable !== candidate.isSearchable) {
    await prisma.candidate.update({ where: { id: candidateId }, data: { isSearchable } });
  }

  return isSearchable;
}
