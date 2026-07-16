import "dotenv/config";
import { PrismaClient, TaxonomyStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SOFTWARE = [
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
];

const SKILLS = [
  "Cold Calling",
  "Lead Generation",
  "Listing Coordination",
  "Transaction Coordination",
  "Social Media Management",
  "CRM Management",
];

async function main() {
  const industry = await prisma.industry.upsert({
    where: { slug: "real-estate" },
    update: {},
    create: { name: "Real Estate", slug: "real-estate" },
  });

  for (const name of SOFTWARE) {
    await prisma.software.upsert({
      where: { name },
      update: {},
      create: {
        name,
        normalizedSlug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        industryId: industry.id,
        status: TaxonomyStatus.APPROVED_GLOBAL,
      },
    });
  }

  for (const name of SKILLS) {
    await prisma.skill.upsert({
      where: { name },
      update: {},
      create: { name, industryId: industry.id, status: TaxonomyStatus.APPROVED_GLOBAL },
    });
  }

  console.log("Seeded industry, software, skills.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
