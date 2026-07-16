import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const PASSWORD = "password1234";

// Signs a user up through the real BetterAuth endpoint so the password hash is valid —
// a raw Prisma insert can't produce a hash BetterAuth will accept at sign-in.
async function signUp(email: string, name: string) {
  const res = await fetch(`${APP_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_URL },
    body: JSON.stringify({ email, password: PASSWORD, name }),
  });
  if (!res.ok && res.status !== 422) {
    // 422 from BetterAuth typically means "user already exists" — fine for a re-runnable seed.
    throw new Error(`Sign-up failed for ${email}: ${res.status} ${await res.text()}`);
  }
  return prisma.user.findUniqueOrThrow({ where: { email } });
}

async function main() {
  const industry = await prisma.industry.findUniqueOrThrow({ where: { slug: "real-estate" } });
  const software = await prisma.software.findMany({ where: { industryId: industry.id } });
  const skills = await prisma.skill.findMany({ where: { industryId: industry.id } });
  const byName = (name: string) => software.find((s) => s.name === name)!;

  // --- Employer ---
  const employerUser = await signUp("employer@test.com", "Employer Owner");
  const workspace = await prisma.workspace.upsert({
    where: { slug: "acme-realty" },
    update: { subscriptionStatus: "ACTIVE", subscriptionTier: "TEAM", jobSlotLimit: 3 },
    create: {
      name: "Acme Realty",
      slug: "acme-realty",
      subscriptionStatus: "ACTIVE",
      subscriptionTier: "TEAM",
      jobSlotLimit: 3,
    },
  });
  await prisma.user.update({ where: { id: employerUser.id }, data: { role: "EMPLOYER_OWNER" } });
  await prisma.employerStaff.upsert({
    where: { userId: employerUser.id },
    update: { workspaceId: workspace.id, approved: true },
    create: { userId: employerUser.id, workspaceId: workspace.id, approved: true, title: "Owner" },
  });

  // --- Candidates ---
  const candidateSeeds = [
    {
      email: "candidate1@test.com",
      name: "Maria Santos",
      rateMin: 8,
      rateMax: 12,
      availability: 40,
      softwareUsed: [
        { name: "Follow Up Boss", proficiency: "ADVANCED" as const },
        { name: "kvCORE", proficiency: "INTERMEDIATE" as const },
        { name: "DocuSign", proficiency: "EXPERT" as const },
      ],
      skillsUsed: ["Cold Calling", "Lead Generation"],
      history: [
        { companyName: "Sunbelt Realty", jobTitle: "VA", start: "2021-01-01", end: "2023-06-01" },
      ],
    },
    {
      email: "candidate2@test.com",
      name: "Juan Dela Cruz",
      rateMin: 10,
      rateMax: 15,
      availability: 30,
      softwareUsed: [
        { name: "Salesforce", proficiency: "EXPERT" as const },
        { name: "Mailchimp", proficiency: "ADVANCED" as const },
      ],
      skillsUsed: ["Transaction Coordination", "CRM Management"],
      history: [
        { companyName: "Coastal Homes Group", jobTitle: "Transaction Coordinator", start: "2020-03-01", end: "2024-01-01" },
      ],
    },
    {
      email: "candidate3@test.com",
      name: "Liza Reyes",
      rateMin: 20,
      rateMax: 25,
      availability: 20,
      softwareUsed: [
        { name: "MLS", proficiency: "ADVANCED" as const },
        { name: "Canva", proficiency: "INTERMEDIATE" as const },
      ],
      skillsUsed: ["Social Media Management", "Listing Coordination"],
      history: [
        { companyName: "Reyes & Partners", jobTitle: "Listing Coordinator", start: "2019-06-01", end: null },
      ],
    },
  ];

  for (const seed of candidateSeeds) {
    const user = await signUp(seed.email, seed.name);
    const [firstName, ...rest] = seed.name.split(" ");
    const candidate = await prisma.candidate.update({
      where: { userId: user.id },
      data: {
        firstName,
        lastName: rest.join(" "),
        targetHourlyRateMin: seed.rateMin,
        targetHourlyRateMax: seed.rateMax,
        weeklyAvailability: seed.availability,
        isSearchable: true, // pre-verified test data — skips the wizard for search/board testing
      },
    });
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });

    for (const period of seed.history) {
      await prisma.employmentPeriod.create({
        data: {
          candidateId: candidate.id,
          companyName: period.companyName,
          jobTitle: period.jobTitle,
          startDate: new Date(period.start),
          endDate: period.end ? new Date(period.end) : null,
          employmentType: "EMPLOYEE",
        },
      });
    }

    for (const s of seed.softwareUsed) {
      await prisma.candidateSoftware.upsert({
        where: { candidateId_softwareId: { candidateId: candidate.id, softwareId: byName(s.name).id } },
        update: { proficiency: s.proficiency },
        create: { candidateId: candidate.id, softwareId: byName(s.name).id, proficiency: s.proficiency },
      });
    }

    for (const skillName of seed.skillsUsed) {
      const skill = skills.find((sk) => sk.name === skillName)!;
      await prisma.candidateSkill.upsert({
        where: { candidateId_skillId: { candidateId: candidate.id, skillId: skill.id } },
        update: {},
        create: { candidateId: candidate.id, skillId: skill.id },
      });
    }
  }

  // --- Sample job post ---
  // Let Postgres generate a real v4 UUID (gen_random_uuid(), per schema default) rather than a
  // hardcoded placeholder — a fixed all-zeros id fails the router's z.string().uuid() validator.
  const jobPostTitle = "Real Estate VA — Lead Gen & CRM";
  const existingJobPost = await prisma.jobPost.findFirst({
    where: { workspaceId: workspace.id, title: jobPostTitle },
  });
  const jobPost =
    existingJobPost ??
    (await prisma.jobPost.create({
      data: {
        workspaceId: workspace.id,
        industryId: industry.id,
        title: jobPostTitle,
        description: "Looking for an experienced VA to manage Follow Up Boss and run cold-calling campaigns.",
        status: "DRAFT",
        targetRateMin: 8,
        targetRateMax: 15,
        requiredHoursMin: 30,
        requiredSoftware: {
          create: [{ softwareId: byName("Follow Up Boss").id, minProficiency: "INTERMEDIATE", isMandatory: true }],
        },
      },
    }));

  console.log("Seeded test data:");
  console.log(`  Employer login: employer@test.com / ${PASSWORD} (workspace: ${workspace.slug})`);
  console.log(`  Candidate logins: candidate1@test.com, candidate2@test.com, candidate3@test.com / ${PASSWORD}`);
  console.log(`  Job post (DRAFT, activate it in /jobs): ${jobPost.title} [${jobPost.id}]`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
