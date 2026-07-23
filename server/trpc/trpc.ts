import { initTRPC, TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import superjson from "superjson";
import type { TRPCContext } from "@/server/trpc/context";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  sse: {
    ping: { enabled: true, intervalMs: 3000 },
    client: { reconnectAfterInactivityMs: 5000 },
  },
  errorFormatter({ shape, error }) {
    // findUniqueOrThrow/findFirstOrThrow raise Prisma's own NotFoundError (P2025), which
    // isn't a TRPCError — unmapped it crashes the function as an unhandled 500 instead of
    // surfacing as a normal 404 the client can handle.
    if (error.cause instanceof Prisma.PrismaClientKnownRequestError && error.cause.code === "P2025") {
      return { ...shape, data: { ...shape.data, code: "NOT_FOUND" as const, httpStatus: 404 } };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

export const protectedProcedure = publicProcedure.use(isAuthed);

function requireRole(...roles: Array<"SUPER_ADMIN" | "PLATFORM_OPERATOR" | "EMPLOYER_OWNER" | "EMPLOYER_RECRUITER" | "CANDIDATE">) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const userRole = (ctx.session.user as { role?: string }).role;
    if (!userRole || !roles.includes(userRole as typeof roles[number])) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx: { ...ctx, session: ctx.session } });
  });
}

export const candidateProcedure = protectedProcedure.use(requireRole("CANDIDATE"));
export const employerProcedure = protectedProcedure.use(
  requireRole("EMPLOYER_OWNER", "EMPLOYER_RECRUITER"),
);
export const employerOwnerProcedure = protectedProcedure.use(requireRole("EMPLOYER_OWNER"));
export const adminProcedure = protectedProcedure.use(
  requireRole("SUPER_ADMIN", "PLATFORM_OPERATOR"),
);
