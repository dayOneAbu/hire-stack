import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { refreshCandidateChunks, refreshJobPostEmbedding, refreshAnomalyEmbedding } from "@/server/services/embeddings";
import { computeMatchScore } from "@/server/services/matchScore";
import { recomputeIsSearchable } from "@/server/services/publishGate";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const PASSWORD = "demopass1234";

// Signs a user up through the real BetterAuth endpoint so the password hash is valid —
// a raw Prisma insert can't produce a hash BetterAuth will accept at sign-in.
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

async function main() {
  const industry = await prisma.industry.findUniqueOrThrow({ where: { slug: "real-estate" } });
  const software = await prisma.software.findMany({ where: { industryId: industry.id } });
  const skills = await prisma.skill.findMany({ where: { industryId: industry.id } });
  const byName = (name: string) => software.find((s) => s.name === name)!;

  // --- Admin ---
  const adminUser = await signUp("demo-admin@hirestack.dev", "Demo Admin");
  await prisma.user.update({ where: { id: adminUser.id }, data: { role: "SUPER_ADMIN", emailVerified: true } });

  // --- Employer ---
  const employerUser = await signUp("demo-employer@hirestack.dev", "Demo Employer");
  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo-realty-group" },
    update: { subscriptionStatus: "ACTIVE", subscriptionTier: "TEAM", jobSlotLimit: 5 },
    create: {
      name: "Demo Realty Group",
      slug: "demo-realty-group",
      subscriptionStatus: "ACTIVE",
      subscriptionTier: "TEAM",
      jobSlotLimit: 5,
    },
  });
  await prisma.user.update({ where: { id: employerUser.id }, data: { role: "EMPLOYER_OWNER", emailVerified: true } });
  await prisma.employerStaff.upsert({
    where: { userId: employerUser.id },
    update: { workspaceId: workspace.id, approved: true },
    create: { userId: employerUser.id, workspaceId: workspace.id, approved: true, title: "Owner" },
  });

  // --- The primary candidate persona (fully searchable, resolved anomaly) ---
  const candidateUser = await signUp("demo-candidate@hirestack.dev", "Demo Candidate");
  const candidate = await prisma.candidate.update({
    where: { userId: candidateUser.id },
    data: {
      firstName: "Demo",
      lastName: "Candidate",
      bio: "Detail-oriented real estate VA with 4 years of experience running lead-gen campaigns, managing CRM pipelines in Follow Up Boss, and coordinating transactions end-to-end for US-based brokerages.",
      targetHourlyRateMin: 10,
      targetHourlyRateMax: 16,
      weeklyAvailability: 35,
      resumeParseStatus: "PARSED",
    },
  });
  await prisma.user.update({ where: { id: candidateUser.id }, data: { emailVerified: true } });

  const periods = await Promise.all([
    prisma.employmentPeriod.create({
      data: {
        candidateId: candidate.id,
        companyName: "Golden Gate Realty",
        jobTitle: "Lead Generation VA",
        startDate: new Date("2020-02-01"),
        endDate: new Date("2022-05-01"),
        description: "Ran cold-calling and lead-gen campaigns in Follow Up Boss for a 12-agent team.",
        documentedHourlyRate: 9,
        employmentType: "EMPLOYEE",
      },
    }),
    prisma.employmentPeriod.create({
      data: {
        candidateId: candidate.id,
        companyName: "Coastal Properties Inc",
        jobTitle: "Transaction Coordinator",
        startDate: new Date("2022-06-01"),
        endDate: null,
        description: "Coordinated closings end-to-end using DocuSign and kvCORE for a 6-agent brokerage.",
        documentedHourlyRate: 14,
        employmentType: "EMPLOYEE",
      },
    }),
  ]);

  // One resolved anomaly (candidate answered it) so the admin similar-anomalies feature has
  // real embedded precedent to match against.
  const resolvedAnomaly = await prisma.employmentAnomaly.create({
    data: {
      employmentPeriodId: periods[0].id,
      ruleType: "MISSING_WAGE_RANGE",
      confidenceScore: 0.8,
      systemNote: "Documented hourly rate of $9/hr falls outside the typical $12-25/hr range for Lead Generation VA roles.",
      status: "RESOLVED_BY_CANDIDATE",
      candidateAnswer: "This was an entry-level role early in my career, before I built up my Follow Up Boss expertise. My rate has grown with my experience since.",
      resolvedAt: new Date(),
    },
  });
  // One still-open anomaly, so the wizard/review-queue screens have something to show.
  await prisma.employmentAnomaly.create({
    data: {
      employmentPeriodId: periods[1].id,
      ruleType: "UNUSUAL_JOB_DURATION",
      confidenceScore: 0.6,
      systemNote: "Current role has run longer than 3 years without a documented rate change.",
      status: "PENDING_CANDIDATE",
    },
  });

  for (const s of [
    { name: "Follow Up Boss", proficiency: "EXPERT" as const },
    { name: "kvCORE", proficiency: "ADVANCED" as const },
    { name: "DocuSign", proficiency: "ADVANCED" as const },
  ]) {
    await prisma.candidateSoftware.upsert({
      where: { candidateId_softwareId: { candidateId: candidate.id, softwareId: byName(s.name).id } },
      update: { proficiency: s.proficiency },
      create: { candidateId: candidate.id, softwareId: byName(s.name).id, proficiency: s.proficiency },
    });
  }
  for (const skillName of ["Lead Generation", "Transaction Coordination"]) {
    const skill = skills.find((sk) => sk.name === skillName);
    if (skill) {
      await prisma.candidateSkill.upsert({
        where: { candidateId_skillId: { candidateId: candidate.id, skillId: skill.id } },
        update: {},
        create: { candidateId: candidate.id, skillId: skill.id },
      });
    }
  }

  await recomputeIsSearchable(candidate.id);

  // --- Extra searchable candidates, so semantic search has real breadth ---
  const extraCandidateSeeds = [
    {
      email: "demo-extra1@hirestack.dev",
      name: "Extra One",
      bio: "Bilingual VA focused on tenant screening, rent collection follow-up, and QuickBooks bookkeeping for landlords managing 30+ unit portfolios.",
      rateMin: 11,
      rateMax: 17,
      software: [{ name: "MLS", proficiency: "ADVANCED" as const }],
      skillNames: ["Listing Coordination"],
    },
    {
      email: "demo-extra2@hirestack.dev",
      name: "Extra Two",
      bio: "Social-media-savvy listing coordinator, builds Canva marketing packets and manages MLS listings for boutique brokerages.",
      rateMin: 9,
      rateMax: 14,
      software: [
        { name: "MLS", proficiency: "EXPERT" as const },
        { name: "Canva", proficiency: "ADVANCED" as const },
      ],
      skillNames: ["Social Media Management"],
    },
    {
      email: "demo-extra3@hirestack.dev",
      name: "Extra Three",
      bio: "Salesforce-certified CRM administrator who builds automated nurture campaigns and manages a Mailchimp email pipeline for real estate teams.",
      rateMin: 15,
      rateMax: 22,
      software: [
        { name: "Salesforce", proficiency: "EXPERT" as const },
        { name: "Mailchimp", proficiency: "ADVANCED" as const },
      ],
      skillNames: ["CRM Management"],
    },
  ];

  const extraCandidateIds: string[] = [];
  for (const seed of extraCandidateSeeds) {
    const user = await signUp(seed.email, seed.name);
    const [firstName, ...rest] = seed.name.split(" ");
    const extraCandidate = await prisma.candidate.update({
      where: { userId: user.id },
      data: {
        firstName,
        lastName: rest.join(" "),
        bio: seed.bio,
        targetHourlyRateMin: seed.rateMin,
        targetHourlyRateMax: seed.rateMax,
        weeklyAvailability: 30,
        resumeParseStatus: "PARSED",
      },
    });
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });

    for (const s of seed.software) {
      await prisma.candidateSoftware.upsert({
        where: { candidateId_softwareId: { candidateId: extraCandidate.id, softwareId: byName(s.name).id } },
        update: { proficiency: s.proficiency },
        create: { candidateId: extraCandidate.id, softwareId: byName(s.name).id, proficiency: s.proficiency },
      });
    }
    for (const skillName of seed.skillNames) {
      const skill = skills.find((sk) => sk.name === skillName);
      if (skill) {
        await prisma.candidateSkill.upsert({
          where: { candidateId_skillId: { candidateId: extraCandidate.id, skillId: skill.id } },
          update: {},
          create: { candidateId: extraCandidate.id, skillId: skill.id },
        });
      }
    }
    await recomputeIsSearchable(extraCandidate.id);
    extraCandidateIds.push(extraCandidate.id);
  }

  // --- Two ACTIVE jobs, applications spread across Kanban stages (for 4.2's funnel) ---
  const jobSeeds = [
    {
      title: "Real Estate VA — Lead Gen & CRM",
      description: "Manage Follow Up Boss, run cold-calling campaigns, keep the pipeline warm.",
      rateMin: 10,
      rateMax: 16,
      hours: 30,
      requiredSoftware: [{ name: "Follow Up Boss", minProficiency: "INTERMEDIATE" as const }],
    },
    {
      title: "Transaction Coordinator — Closings & Docs",
      description: "Own closings end-to-end: DocuSign, kvCORE, client follow-up.",
      rateMin: 12,
      rateMax: 20,
      hours: 25,
      requiredSoftware: [{ name: "DocuSign", minProficiency: "INTERMEDIATE" as const }],
    },
  ];

  const jobPosts = [];
  for (const seed of jobSeeds) {
    const existing = await prisma.jobPost.findFirst({ where: { workspaceId: workspace.id, title: seed.title } });
    const jobPost =
      existing ??
      (await prisma.jobPost.create({
        data: {
          workspaceId: workspace.id,
          industryId: industry.id,
          title: seed.title,
          description: seed.description,
          status: "DRAFT",
          targetRateMin: seed.rateMin,
          targetRateMax: seed.rateMax,
          requiredHoursMin: seed.hours,
          requiredSoftware: {
            create: seed.requiredSoftware.map((s) => ({
              softwareId: byName(s.name).id,
              minProficiency: s.minProficiency,
              isMandatory: true,
            })),
          },
        },
      }));

    if (jobPost.status === "DRAFT") {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await prisma.jobPost.update({
        where: { id: jobPost.id },
        data: { status: "ACTIVE", activatedAt: now, expiresAt },
      });
    }
    jobPosts.push(jobPost);
  }

  // Spread applications across the funnel: primary candidate + extras land in different stages.
  const stagePlan: Array<{ candidateId: string; stage: "INBOX" | "SCREENING" | "TECHNICAL_ASSESSMENT" | "INTERVIEW" | "HIRED" | "REJECTED" }> = [
    { candidateId: candidate.id, stage: "INTERVIEW" },
    { candidateId: extraCandidateIds[0], stage: "SCREENING" },
    { candidateId: extraCandidateIds[1], stage: "INBOX" },
    { candidateId: extraCandidateIds[2], stage: "REJECTED" },
  ];

  for (const jobPost of jobPosts) {
    for (const { candidateId, stage } of stagePlan) {
      const scoreBreakdown = await computeMatchScore(candidateId, jobPost.id);
      await prisma.jobApplication.upsert({
        where: { jobPostId_candidateId: { jobPostId: jobPost.id, candidateId } },
        update: {},
        create: {
          jobPostId: jobPost.id,
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

  // --- Embeddings: chunks for every candidate, embeddings for active jobs and the resolved anomaly ---
  for (const id of [candidate.id, ...extraCandidateIds]) {
    await refreshCandidateChunks(id);
  }
  for (const jobPost of jobPosts) {
    await refreshJobPostEmbedding(jobPost.id);
  }
  await refreshAnomalyEmbedding(resolvedAnomaly.id);

  console.log("Seeded demo data:");
  console.log(`  Admin login: demo-admin@hirestack.dev / ${PASSWORD}`);
  console.log(`  Employer login: demo-employer@hirestack.dev / ${PASSWORD} (workspace: ${workspace.slug})`);
  console.log(`  Candidate login: demo-candidate@hirestack.dev / ${PASSWORD}`);
  console.log(`  ${extraCandidateIds.length} extra searchable candidates seeded for semantic search breadth.`);
  console.log(`  ${jobPosts.length} ACTIVE job posts with applications spread across the Kanban funnel.`);
  console.log("  NOTE: no SIGNED offer / HELD payment seeded — STRIPE_SECRET_KEY is still a placeholder");
  console.log("  in .env, and Payment rows require a real Stripe PaymentIntent id. Seed that manually");
  console.log("  once a real Stripe test key is available, by running the real offer -> fund flow in the UI.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
