import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const AUTH_PATHS = ["/sign-in", "/sign-up"];

const ROUTE_ROLES: Record<string, string[]> = {
  "/onboarding": ["CANDIDATE"],
  "/dashboard": ["CANDIDATE"],
  "/search": ["EMPLOYER_OWNER", "EMPLOYER_RECRUITER"],
  "/jobs": ["EMPLOYER_OWNER", "EMPLOYER_RECRUITER"],
  "/board": ["EMPLOYER_OWNER", "EMPLOYER_RECRUITER"],
  "/review-queue": ["SUPER_ADMIN", "PLATFORM_OPERATOR"],
  "/software-queue": ["SUPER_ADMIN", "PLATFORM_OPERATOR"],
  "/users": ["SUPER_ADMIN", "PLATFORM_OPERATOR"],
};

function homeFor(role: string | undefined): string {
  if (role === "EMPLOYER_OWNER" || role === "EMPLOYER_RECRUITER") return "/jobs";
  if (role === "SUPER_ADMIN" || role === "PLATFORM_OPERATOR") return "/review-queue";
  return "/onboarding";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (AUTH_PATHS.includes(pathname)) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session) {
      const role = (session.user as { role?: string }).role;
      return NextResponse.redirect(new URL(homeFor(role), request.url));
    }
    return NextResponse.next();
  }

  const matchedPrefix = Object.keys(ROUTE_ROLES).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!matchedPrefix) return NextResponse.next();

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const role = (session.user as { role?: string }).role;
  if (!role || !ROUTE_ROLES[matchedPrefix].includes(role)) {
    return NextResponse.redirect(new URL(homeFor(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/sign-in",
    "/sign-up",
    "/onboarding/:path*",
    "/dashboard/:path*",
    "/search/:path*",
    "/jobs/:path*",
    "/board/:path*",
    "/review-queue/:path*",
    "/software-queue/:path*",
    "/users/:path*",
  ],
};
