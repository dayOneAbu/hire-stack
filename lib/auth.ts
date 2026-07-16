import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  // Schema defines ids as @db.Uuid (gen_random_uuid()) — let Postgres generate them
  // instead of BetterAuth's default nanoid strings, which violate the uuid column type.
  advanced: {
    database: {
      generateId: false,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // FRS §1: verification gates publish, not wizard access
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "CANDIDATE",
        input: false, // role is assigned server-side, never client-writable
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Every signup defaults to CANDIDATE role, so every user needs a Candidate row
          // to satisfy candidateProcedure's findUniqueOrThrow — no separate "complete profile" step.
          if ((user as { role?: string }).role !== "CANDIDATE") return;
          const [firstName, ...rest] = (user.name ?? "").trim().split(" ");
          await prisma.candidate.create({
            data: {
              userId: user.id,
              firstName: firstName || "New",
              lastName: rest.join(" ") || "Candidate",
            },
          });
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
