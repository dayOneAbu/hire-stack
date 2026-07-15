import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

export async function createTRPCContext(opts: { req: NextRequest }) {
  const session = await auth.api.getSession({ headers: opts.req.headers });

  return {
    prisma,
    session,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
