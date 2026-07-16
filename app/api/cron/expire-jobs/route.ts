import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Daily cron target: close ACTIVE job posts past their expiry (FRS §12 — 30-day window).
export async function POST() {
  const { count } = await prisma.jobPost.updateMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
    data: { status: "CLOSED" },
  });
  return NextResponse.json({ closed: count });
}
