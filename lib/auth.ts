import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { prisma } from "@/lib/prisma";

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
}

export const auth = betterAuth({
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const user = await prisma.user.findUnique({ where: { email: ctx.body?.email } });
      if (user?.deletedAt) {
        throw new APIError("FORBIDDEN", { message: "This account has been suspended." });
      }
    }),
  },
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
      // Client-supplied signup intent, read only inside databaseHooks.user.create.after and
      // mapped to a role there — never trust a client-supplied role directly (Phase 6).
      signupIntent: {
        type: "string",
        defaultValue: "CANDIDATE",
        input: true,
      },
      companyName: {
        type: "string",
        required: false,
        input: true,
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
        // Runs before insert so the role BetterAuth persists — and therefore the role baked
        // into the initial session/cookie cache — is already correct. Setting role in `after`
        // instead left the session reading the stale default (CANDIDATE) for the cookie cache's
        // lifetime, since `after` can't change what was already written/returned.
        before: async (user) => {
          const created = user as { signupIntent?: string };
          if (created.signupIntent === "EMPLOYER") {
            return { data: { ...user, role: "EMPLOYER_OWNER" } };
          }
        },
        after: async (user) => {
          const created = user as { role?: string; signupIntent?: string; companyName?: string | null };

          if (created.signupIntent === "EMPLOYER") {
            const workspace = await prisma.workspace.create({
              data: {
                name: created.companyName || "My Workspace",
                slug: `${slugify(created.companyName || "workspace")}-${user.id.slice(0, 8)}`,
                subscriptionTier: "FREE",
                jobSlotLimit: 0,
              },
            });
            await prisma.employerStaff.create({
              data: { userId: user.id, workspaceId: workspace.id, approved: true },
            });
            return;
          }

          // Default path: every other signup is a candidate, so every user needs a
          // Candidate row to satisfy candidateProcedure's findUniqueOrThrow — no separate
          // "complete profile" step.
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
