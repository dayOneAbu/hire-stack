import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cronAuth";

// Daily cron target: close ACTIVE job posts past their expiry (FRS §12 — 30-day window).
export async function POST(request: Request) {
  const unauthorized = verifyCronAuth(request);
  if (unauthorized) return unauthorized;

  const { count } = await prisma.jobPost.updateMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
    data: { status: "CLOSED" },
  });
  return NextResponse.json({ closed: count });
}
