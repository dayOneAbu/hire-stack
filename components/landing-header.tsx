"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

function dashboardHref(role: string | undefined) {
  if (role === "EMPLOYER_OWNER" || role === "EMPLOYER_RECRUITER") return "/jobs";
  if (role === "SUPER_ADMIN" || role === "PLATFORM_OPERATOR") return "/review-queue";
  return "/dashboard";
}

export function LandingHeader() {
  const { data: session } = authClient.useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <ShieldCheck className="size-5 text-primary" />
          HireStack
        </div>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#how-it-works" className="hover:text-foreground">How it works</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {session ? (
            <Link href={dashboardHref(role)} className={cn(buttonVariants({ size: "sm" }))}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
                Sign in
              </Link>
              <Link href="/sign-up?as=employer" className={cn(buttonVariants({ size: "sm" }))}>
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
