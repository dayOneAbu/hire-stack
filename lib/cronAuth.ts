import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// Shared guard for app/api/cron/* routes — verifies `Authorization: Bearer <CRON_SECRET>`.
export function verifyCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice(7) : "";

  const expected = Buffer.from(secret ?? "");
  const actual = Buffer.from(provided);
  const valid =
    secret && expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
