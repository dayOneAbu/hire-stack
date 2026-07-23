import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { computeMatchScore } from "@/server/services/matchScore";
import { recomputeIsSearchable } from "@/server/services/publishGate";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const PASSWORD = "bulkpass1234";

async function signUp(email: string, name: string) {
  const res = await fetch(`${APP_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_URL },
    body: JSON.stringify({ email, password: PASSWORD, name }),
  });
  if (!res.ok && res.status !== 422) {
    throw new Error(`Sign-up failed for ${email}: ${res.status} ${await res.text()}`);
  }
  return prisma.user.findUniqueOrThrow({ where: { email } });
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const FIRST_NAMES = [
  "Maria", "Juan", "Liza", "Ana", "Carlos", "Grace", "Mark", "Rosa", "Paolo", "Ella",
  "Miguel", "Joy", "Rico", "Cheryl", "Ben", "Divine", "Aldrin", "Cristina", "Kevin", "Nadia",
  "Ramon", "Fely", "Jerico", "Angel", "Noel", "Vera", "Dennis", "Lourdes", "Ryan", "Bea",
  "Oscar", "Tricia", "Edwin", "Jenny", "Arnel", "Kim", "Vince", "Marielle", "Tony", "Shane",
];
const LAST_NAMES = [
  "Santos", "Reyes", "Cruz", "Bautista", "Ocampo", "Garcia", "Mendoza", "Torres", "Flores", "Ramos",
  "Villanueva", "Castillo", "Aquino", "Del Rosario", "Navarro", "Domingo", "Salazar", "Gonzales", "Pascual", "Rivera",
];

const SOFTWARE_NAMES = ["Follow Up Boss", "kvCORE", "Salesforce", "MLS", "DocuSign", "Canva", "Mailchimp", "Slack", "QuickBooks", "Zillow Premier Agent"];
const SKILL_NAMES = ["Cold Calling", "Lead Generation", "Listing Coordination", "Transaction Coordination", "Social Media Management", "CRM Management"];

const COMPANY_NAMES = [
  "Golden Gate Realty", "Coastal Properties Inc", "Sunbelt Realty", "Reyes & Partners", "Bayview Homes",
  "Highland Estates", "Pacific Realty Group", "Metro Living", "Cornerstone Properties", "Willow Creek Realty",
];

const EMPLOYER_WORKSPACES = [
  "Pacific Coast Realty", "Sunrise Property Group", "Bayline Homes", "Redwood Realty Partners", "Anchor Realty Co",
  "Silverline Properties", "Meridian Real Estate", "Crestview Realty", "Harborview Homes", "Northgate Realty Group",
];

const JOB_TITLE_TEMPLATES = [
  "Real Estate VA — Lead Gen & CRM",
  "Transaction Coordinator — Closings & Docs",
  "Listing Coordinator — MLS & Marketing",
  "Cold Calling Specialist — Inbound & Outbound",
  "Social Media & Marketing VA",
  "Bookkeeping & Admin VA",
  "ISA — Inside Sales Agent",
  "Client Follow-Up Coordinator",
];

const STAGE_POOL: Array<"INBOX" | "SCREENING" | "TECHNICAL_ASSESSMENT" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED"> = [
  "INBOX", "INBOX", "INBOX", "SCREENING", "SCREENING", "TECHNICAL_ASSESSMENT", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "REJECTED",
];

async function main() {
  const industry = await prisma.industry.findUniqueOrThrow({ where: { slug: "real-estate" } });

  const adminUser = await signUp("admin1@bulktest.dev", "Bulk Admin");
  await prisma.user.update({ where: { id: adminUser.id }, data: { role: "SUPER_ADMIN", emailVerified: true } });
  const software = await prisma.software.findMany({ where: { industryId: industry.id } });
  const skills = await prisma.skill.findMany({ where: { industryId: industry.id } });
  const byName = (name: string) => software.find((s) => s.name === name)!;
  const skillByName = (name: string) => skills.find((s) => s.name === name)!;

  // --- 10 employers, each with 3-20 jobs (one gets 20 for board/DnD testing) ---
  console.log("Seeding employers + jobs...");
  const workspaces: { id: string; slug: string }[] = [];
  const allJobPosts: { id: string; workspaceId: string; status: string }[] = [];

  for (let i = 0; i < 10; i++) {
    const name = EMPLOYER_WORKSPACES[i];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const email = `employer${i + 1}@bulktest.dev`;
    const employerUser = await signUp(email, `${name} Owner`);
    const workspace = await prisma.workspace.upsert({
      where: { slug },
      update: { subscriptionStatus: "ACTIVE", subscriptionTier: "TEAM", jobSlotLimit: 25 },
      create: { name, slug, subscriptionStatus: "ACTIVE", subscriptionTier: "TEAM", jobSlotLimit: 25 },
    });
    await prisma.user.update({ where: { id: employerUser.id }, data: { role: "EMPLOYER_OWNER", emailVerified: true } });
    await prisma.employerStaff.upsert({
      where: { userId: employerUser.id },
      update: { workspaceId: workspace.id, approved: true },
      create: { userId: employerUser.id, workspaceId: workspace.id, approved: true, title: "Owner" },
    });
    workspaces.push(workspace);

    // Default/primary login (first employer) gets 20 jobs for board testing; rest get 3-6.
    const jobCount = i === 0 ? 20 : randInt(3, 6);
    for (let j = 0; j < jobCount; j++) {
      const title = `${pick(JOB_TITLE_TEMPLATES)} #${j + 1}`;
      const reqSoftware = pickN(SOFTWARE_NAMES, randInt(1, 2));
      const jobPost = await prisma.jobPost.create({
        data: {
          workspaceId: workspace.id,
          industryId: industry.id,
          title,
          description: `Looking for a reliable VA to support ${name}'s operations. Must be detail-oriented and responsive.`,
          status: "DRAFT",
          targetRateMin: randInt(8, 14),
          targetRateMax: randInt(15, 25),
          requiredHoursMin: pick([20, 25, 30, 35, 40]),
          requiredSoftware: {
            create: reqSoftware.map((s) => ({ softwareId: byName(s).id, minProficiency: pick(["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const), isMandatory: true })),
          },
        },
      });
      // Most jobs ACTIVE (so they show up on boards/search); a few stay DRAFT/PAUSED/CLOSED for status variety.
      const finalStatus = pick(["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "DRAFT", "PAUSED", "CLOSED"] as const);
      if (finalStatus !== "DRAFT") {
        const now = new Date();
        await prisma.jobPost.update({
          where: { id: jobPost.id },
          data: {
            status: finalStatus,
            activatedAt: now,
            expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }
      allJobPosts.push({ id: jobPost.id, workspaceId: workspace.id, status: finalStatus });
    }
  }

  // --- 100 candidates, randomized profiles, ~85% fully searchable ---
  console.log("Seeding candidates...");
  const candidateIds: string[] = [];
  for (let i = 0; i < 100; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const email = `candidate${i + 1}@bulktest.dev`;
    const user = await signUp(email, `${firstName} ${lastName}`);
    const rateMin = randInt(7, 18);
    const candidate = await prisma.candidate.update({
      where: { userId: user.id },
      data: {
        firstName,
        lastName,
        bio: `Real estate VA experienced with ${pick(SKILL_NAMES).toLowerCase()} and ${pick(SOFTWARE_NAMES)}.`,
        targetHourlyRateMin: rateMin,
        targetHourlyRateMax: rateMin + randInt(4, 10),
        weeklyAvailability: pick([20, 25, 30, 35, 40]),
        resumeParseStatus: "PARSED",
      },
    });
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });

    // 1-2 employment periods per candidate.
    const periodCount = randInt(1, 2);
    const periodIds: string[] = [];
    for (let p = 0; p < periodCount; p++) {
      const startYear = randInt(2018, 2022);
      const period = await prisma.employmentPeriod.create({
        data: {
          candidateId: candidate.id,
          companyName: pick(COMPANY_NAMES),
          jobTitle: pick(["VA", "Lead Generation VA", "Transaction Coordinator", "Listing Coordinator", "ISA"]),
          startDate: new Date(`${startYear}-01-01`),
          endDate: p === periodCount - 1 && Math.random() > 0.5 ? null : new Date(`${startYear + randInt(1, 3)}-01-01`),
          documentedHourlyRate: randInt(7, 22),
          employmentType: "EMPLOYEE",
        },
      });
      periodIds.push(period.id);
    }

    for (const s of pickN(SOFTWARE_NAMES, randInt(1, 3))) {
      await prisma.candidateSoftware.upsert({
        where: { candidateId_softwareId: { candidateId: candidate.id, softwareId: byName(s).id } },
        update: {},
        create: { candidateId: candidate.id, softwareId: byName(s).id, proficiency: pick(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const) },
      });
    }
    for (const skillName of pickN(SKILL_NAMES, randInt(1, 3))) {
      await prisma.candidateSkill.upsert({
        where: { candidateId_skillId: { candidateId: candidate.id, skillId: skillByName(skillName).id } },
        update: {},
        create: { candidateId: candidate.id, skillId: skillByName(skillName).id },
      });
    }

    // ~15% of candidates get a still-open anomaly, keeping them out of search (realistic mix).
    if (Math.random() < 0.15) {
      await prisma.employmentAnomaly.create({
        data: {
          employmentPeriodId: pick(periodIds),
          ruleType: pick(["MISSING_WAGE_RANGE", "UNUSUAL_JOB_DURATION"] as const),
          confidenceScore: Math.random() * 0.5 + 0.4,
          systemNote: "Flagged by automated rule pass for admin/candidate review.",
          status: pick(["PENDING_CANDIDATE", "FLAGGED_FOR_ADMIN_REVIEW"] as const),
        },
      });
    }

    await recomputeIsSearchable(candidate.id);
    candidateIds.push(candidate.id);
  }

  // --- Applications: randomly apply candidates to jobs, spread across Kanban stages ---
  console.log("Seeding applications...");
  const activeJobs = allJobPosts.filter((j) => j.status === "ACTIVE");
  for (const candidateId of candidateIds) {
    const applyCount = randInt(0, 4);
    const targetJobs = pickN(activeJobs, Math.min(applyCount, activeJobs.length));
    for (const job of targetJobs) {
      const scoreBreakdown = await computeMatchScore(candidateId, job.id);
      await prisma.jobApplication.upsert({
        where: { jobPostId_candidateId: { jobPostId: job.id, candidateId } },
        update: {},
        create: {
          jobPostId: job.id,
          candidateId,
          source: pick(["EMPLOYER_ADDED", "CANDIDATE_APPLIED"] as const),
          currentStage: pick(STAGE_POOL),
          softwareScore: scoreBreakdown.softwareScore,
          experienceScore: scoreBreakdown.experienceScore,
          compScore: scoreBreakdown.compScore,
          availabilityScore: scoreBreakdown.availabilityScore,
          overallMatchScore: scoreBreakdown.overallMatchScore,
        },
      });
    }
  }

  // Guarantee the primary/default employer's job board (first workspace) has a rich, visibly
  // mixed spread across every stage for drag-and-drop testing, not just whatever randomness gave it.
  const primaryJobs = allJobPosts.filter((j) => j.workspaceId === workspaces[0].id && j.status === "ACTIVE");
  for (const job of primaryJobs.slice(0, 5)) {
    const applicants = pickN(candidateIds, 8);
    for (let i = 0; i < applicants.length; i++) {
      const candidateId = applicants[i];
      const stage = STAGE_POOL[i % STAGE_POOL.length];
      const scoreBreakdown = await computeMatchScore(candidateId, job.id);
      await prisma.jobApplication.upsert({
        where: { jobPostId_candidateId: { jobPostId: job.id, candidateId } },
        update: { currentStage: stage },
        create: {
          jobPostId: job.id,
          candidateId,
          source: "EMPLOYER_ADDED",
          currentStage: stage,
          softwareScore: scoreBreakdown.softwareScore,
          experienceScore: scoreBreakdown.experienceScore,
          compScore: scoreBreakdown.compScore,
          availabilityScore: scoreBreakdown.availabilityScore,
          overallMatchScore: scoreBreakdown.overallMatchScore,
        },
      });
    }
  }

  console.log("\nSeeded bulk demo data:");
  console.log(`  Admin login: admin1@bulktest.dev / ${PASSWORD}`);
  console.log(`  ${workspaces.length} employers, password: ${PASSWORD}`);
  console.log(`    Primary (20 jobs, full Kanban spread): employer1@bulktest.dev`);
  console.log(`  ${candidateIds.length} candidates, password: ${PASSWORD} (candidate1@bulktest.dev .. candidate100@bulktest.dev)`);
  console.log(`  ${allJobPosts.length} total job posts across all employers`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
