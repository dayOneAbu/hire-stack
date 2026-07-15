import { NextResponse } from "next/server";

// Pinged by UptimeRobot every 5 minutes to keep the Render free-tier
// instance warm (NFRS §1 / PRD §8). Intentionally cheap — no DB roundtrip.
export function GET() {
  return NextResponse.json({ status: "ok" });
}
