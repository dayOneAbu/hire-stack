import "dotenv/config";
import { PrismaClient, TaxonomyStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const INDUSTRIES = [
  {
    name: "Real Estate",
    slug: "real-estate",
    software: [
      "Follow Up Boss",
      "kvCORE",
      "Salesforce",
      "MLS",
      "DocuSign",
      "Canva",
      "Mailchimp",
      "Slack",
      "QuickBooks",
      "Zillow Premier Agent",
    ],
    skills: [
      "Cold Calling",
      "Lead Generation",
      "Listing Coordination",
      "Transaction Coordination",
      "Social Media Management",
      "CRM Management",
    ],
  },
  {
    name: "General Admin & Bookkeeping",
    slug: "general-admin",
    // Software.name is globally unique — QuickBooks/Slack already belong to Real Estate above.
    software: ["Xero", "Google Workspace", "Microsoft Excel", "Asana"],
    skills: ["Bookkeeping", "Data Entry", "Calendar Management", "Customer Support", "Invoicing"],
  },
];

async function main() {
  for (const { name, slug, software, skills } of INDUSTRIES) {
    const industry = await prisma.industry.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });

    await prisma.software.createMany({
      data: software.map((swName) => ({
        name: swName,
        normalizedSlug: swName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        industryId: industry.id,
        status: TaxonomyStatus.APPROVED_GLOBAL,
      })),
      skipDuplicates: true,
    });

    await prisma.skill.createMany({
      data: skills.map((skillName) => ({
        name: skillName,
        industryId: industry.id,
        status: TaxonomyStatus.APPROVED_GLOBAL,
      })),
      skipDuplicates: true,
    });
  }

  console.log(`Seeded ${INDUSTRIES.length} industries with software/skills.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
