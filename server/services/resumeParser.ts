import { prisma } from "@/lib/prisma";
import { getResumeBuffer } from "@/lib/storage";
import { extractText } from "@/server/services/textExtract";
import { extractResumeData } from "@/lib/ai";
import { runAnomalyRules } from "@/server/services/anomalyRules";
import { matchOrSuggestSoftware } from "@/server/services/taxonomyMatch";

const MIN_CONFIDENCE = 0.15;

// Async by design — never blocks the upload endpoint (NFRS §1, ~30s target).
export async function parseResume(candidateId: string, rawResumeUrl: string): Promise<void> {
  try {
    const candidate = await prisma.candidate.findUniqueOrThrow({
      where: { id: candidateId },
      include: { user: true },
    });

    const buffer = await getResumeBuffer(rawResumeUrl);
    const contentType = rawResumeUrl.endsWith(".pdf")
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const text = await extractText(buffer, contentType);
    const extracted = await extractResumeData(text);

    // Near-zero confidence is "could not parse," not an empty-but-valid profile (FRS §16).
    if (extracted.confidence < MIN_CONFIDENCE) {
      await prisma.candidate.update({
        where: { id: candidateId },
        data: { resumeParseStatus: "FAILED" },
      });
      return;
    }

    // Re-upload after publish replaces all prior data entirely, no merge (FRS §16).
    await prisma.employmentPeriod.deleteMany({ where: { candidateId } });

    const industry = await prisma.industry.findFirst();
    if (!industry) throw new Error("No Industry seeded — cannot match software/skills.");

    const createdPeriods = await Promise.all(
      extracted.periods.map((p) =>
        prisma.employmentPeriod.create({
          data: {
            candidateId,
            companyName: p.companyName,
            jobTitle: p.jobTitle ?? "",
            startDate: p.startDate ? new Date(p.startDate) : new Date(),
            endDate: p.endDate ? new Date(p.endDate) : null,
            description: p.description,
            documentedHourlyRate: p.documentedHourlyRate,
          },
        }),
      ),
    );

    const anomalies = runAnomalyRules(createdPeriods);
    if (anomalies.length > 0) {
      await prisma.employmentAnomaly.createMany({ data: anomalies });
    }

    for (const softwareName of extracted.software) {
      const { softwareId } = await matchOrSuggestSoftware(softwareName, industry.id);
      await prisma.candidateSoftware.upsert({
        where: { candidateId_softwareId: { candidateId, softwareId } },
        update: {},
        create: { candidateId, softwareId },
      });
    }

    for (const skillName of extracted.skills) {
      const skill = await prisma.skill.findUnique({ where: { name: skillName } });
      if (skill) {
        await prisma.candidateSkill.upsert({
          where: { candidateId_skillId: { candidateId, skillId: skill.id } },
          update: {},
          create: { candidateId, skillId: skill.id },
        });
      }
    }

    await prisma.candidate.update({
      where: { id: candidateId },
      data: { resumeParseStatus: "PARSED" },
    });
  } catch (err) {
    console.error("Resume parse failed", { candidateId, err });
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { resumeParseStatus: "FAILED" },
    });
  }
}
